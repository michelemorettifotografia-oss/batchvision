import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_TTL_MS, safeCompare, signSession } from '@/app/lib/auth'

export async function POST(req: Request) {
  try {
    const { password } = (await req.json()) as { password?: unknown }

    const expected = process.env.APP_PASSWORD
    const secret = process.env.AUTH_SECRET
    if (!expected || !secret) {
      return NextResponse.json({ error: 'Auth is not configured on the server' }, { status: 503 })
    }

    if (typeof password !== 'string' || !(await safeCompare(password, expected))) {
      // Small delay to blunt rapid brute-force attempts.
      await new Promise((r) => setTimeout(r, 400))
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const expiresAt = Date.now() + SESSION_TTL_MS
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, await signSession(expiresAt, secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
