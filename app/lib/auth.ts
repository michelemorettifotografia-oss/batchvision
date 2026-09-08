import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// ALLOWED_EMAILS is a comma-separated list. An entry starting with "@" allows
// a whole domain (e.g. "@mystudio.it"), so colleagues on the company domain
// never need to be added one by one.
export function isAllowed(email?: string | null): boolean {
  if (!email) return false
  const entries = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // Fail closed: an empty allowlist must not let everyone in.
  if (entries.length === 0) return false

  const e = email.toLowerCase()
  return entries.some((entry) => (entry.startsWith('@') ? e.endsWith(entry) : e === entry))
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, profile }) {
      // Returning false sends the user back to /login?error=AccessDenied
      return isAllowed(profile?.email ?? user?.email)
    },
  },
}
