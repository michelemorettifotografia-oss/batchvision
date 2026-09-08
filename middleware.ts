import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'

// Protect everything except Next's static assets. The API routes matter most:
// that is where Gemini credits are actually spent.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // NextAuth's own endpoints and the login page must stay reachable.
  if (pathname.startsWith('/api/auth') || pathname === '/login') {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // APIs get a real 401 instead of an HTML redirect, so client fetches fail
  // cleanly rather than trying to parse a login page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = pathname === '/' ? '' : `?from=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(url)
}
