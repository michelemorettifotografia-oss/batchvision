// Shared auth helpers. Uses Web Crypto only, so the same code runs in the
// Edge middleware and in Node route handlers.

const encoder = new TextEncoder()

export const SESSION_COOKIE = 'bv_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

// Constant-time compare for equal-length strings.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Compares digests rather than raw values, so the comparison is constant-time
// regardless of input length (a raw compare would leak the password length).
export async function safeCompare(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)])
  return timingSafeEqual(ha, hb)
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

// Session cookie is "<expiry>.<hmac>" — the signature makes it unforgeable
// without AUTH_SECRET, so no server-side session store is needed.
export async function signSession(expiresAt: number, secret: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(expiresAt)))
  return `${expiresAt}.${toHex(sig)}`
}

export async function verifySession(value: string | undefined, secret: string): Promise<boolean> {
  if (!value) return false
  const dot = value.indexOf('.')
  if (dot <= 0) return false

  const expiresAt = Number(value.slice(0, dot))
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  const expected = await signSession(expiresAt, secret)
  return timingSafeEqual(expected, value)
}
