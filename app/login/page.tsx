'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

function errorMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'AccessDenied') {
    return 'That Google account is not authorised for BatchVision. Ask the owner to add your address.'
  }
  return 'Sign-in failed. Please try again.'
}

function LoginBox() {
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)

  const from = params.get('from')
  const callbackUrl = from && from.startsWith('/') ? from : '/'
  const error = errorMessage(params.get('error'))

  return (
    <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 w-full max-w-sm text-center">
      <h1 className="text-2xl font-bold text-white mb-1">BatchVision</h1>
      <p className="text-gray-400 text-sm mb-6">AI Product Design Studio</p>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-900/40 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={() => {
          setBusy(true)
          signIn('google', { callbackUrl })
        }}
        disabled={busy}
        className="w-full bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-3"
      >
        {busy ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57z" />
            <path fill="#34A853" d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.02-6.46-4.75H1.69v2.98A11.5 11.5 0 0 0 12 23.5z" />
            <path fill="#FBBC05" d="M5.54 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.69a11.5 11.5 0 0 0 0 10.3l3.85-2.98z" />
            <path fill="#EA4335" d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.26 15.1.5 12 .5A11.5 11.5 0 0 0 1.69 6.85l3.85 2.98C6.45 7.1 9 4.75 12 4.75z" />
          </svg>
        )}
        Sign in with Google
      </button>

      <p className="text-gray-500 text-xs mt-5">Access is limited to authorised accounts.</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginBox />
      </Suspense>
    </main>
  )
}
