import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/app/lib/auth'

// Protect everything except Next's static assets. The API routes matter most:
// that is where Gemini credits are actually spent.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  const secret = process.env.AUTH_SECRET
  const password = process.env.APP_PASSWORD

  // Fail closed: a deployment without credentials configured must not be
  // usable, otherwise a missing env var would silently expose the API key.
  if (!secret || !password) {
    const msg = 'Auth is not configured. Set APP_PASSWORD and AUTH_SECRET in the environment, then redeploy.'
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = pathname === '/' ? '' : `?from=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(url)
}
