'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import type { Capture3D } from './ModelViewer'

// three.js is large, so the viewer is fetched only when someone opens it and
// never shipped in the main bundle. It is client-only (WebGL), hence ssr: false.
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  ),
})

interface ModelViewerLauncherProps {
  label: string
  maxCaptures: number
  onUse: (captures: Capture3D[]) => void
  disabled?: boolean
}

export default function ModelViewerLauncher({ label, maxCaptures, onUse, disabled }: ModelViewerLauncherProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-gray-300 hover:border-blue-500 hover:text-white transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
        <span className="text-sm">{label}</span>
      </button>

      {/* Portal keeps the modal out of the surrounding <form>, so none of its
          buttons can ever submit it. */}
      {open &&
        createPortal(
          <ModelViewer
            maxCaptures={maxCaptures}
            onClose={() => setOpen(false)}
            onUse={(captures) => {
              onUse(captures)
              setOpen(false)
            }}
          />,
          document.body
        )}
    </>
  )
}
