'use client'

import { useCallback, useEffect, useState } from 'react'
import { isLoaded, type AspectRatio, type ImageSlot, type StyleData } from '@/app/types'

interface LightboxProps {
  styles: StyleData[]
  position: { si: number; pi: number }
  aspectRatio: AspectRatio
  selected: Record<string, boolean>
  onClose: () => void
  onNavigate: (pos: { si: number; pi: number }) => void
  onRegenerate: (si: number, pi: number) => void
  onToggleSelect: (si: number, pi: number) => void
  onGenerateVariants: (si: number, pi: number, count: number) => Promise<ImageSlot[]>
  onAdopt: (si: number, pi: number, image: { imageBase64: string; mimeType: string }) => void
}

const VARIANT_COUNT = 4

export default function Lightbox({
  styles,
  position,
  selected,
  onClose,
  onNavigate,
  onRegenerate,
  onToggleSelect,
  onGenerateVariants,
  onAdopt,
}: LightboxProps) {
  const [variants, setVariants] = useState<ImageSlot[] | null>(null)
  const [loadingVariants, setLoadingVariants] = useState(false)

  // Flat ordered list of every slot for prev/next navigation.
  const order: { si: number; pi: number }[] = []
  styles.forEach((s, si) => s.prompts.forEach((_, pi) => order.push({ si, pi })))
  const currentIndex = order.findIndex((o) => o.si === position.si && o.pi === position.pi)

  const go = useCallback(
    (delta: number) => {
      if (order.length === 0) return
      const next = order[(currentIndex + delta + order.length) % order.length]
      onNavigate(next)
    },
    [order, currentIndex, onNavigate]
  )

  // Reset variants whenever we move to a different slot.
  useEffect(() => {
    setVariants(null)
    setLoadingVariants(false)
  }, [position.si, position.pi])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const style = styles[position.si]
  if (!style) return null
  const image = style.images[position.pi]
  const prompt = style.prompts[position.pi]
  const key = `${position.si}-${position.pi}`
  const isSelected = !!selected[key]

  const handleVariants = async () => {
    setLoadingVariants(true)
    try {
      setVariants(await onGenerateVariants(position.si, position.pi, VARIANT_COUNT))
    } finally {
      setLoadingVariants(false)
    }
  }

  const handleDownload = () => {
    if (!isLoaded(image)) return
    const ext = image.mimeType.split('/')[1] || 'png'
    const a = document.createElement('a')
    a.href = `data:${image.mimeType};base64,${image.imageBase64}`
    a.download = `style${position.si + 1}_${style.name.replace(/\s+/g, '_')}_${position.pi + 1}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-gray-300">
          Style {position.si + 1} · Image {position.pi + 1}
          <span className="text-gray-500"> · {currentIndex + 1}/{order.length}</span>
        </span>
        <button onClick={onClose} className="text-gray-300 hover:text-white p-1" title="Close (Esc)">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} className="text-white/70 hover:text-white p-2 shrink-0" title="Previous (←)">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 h-full flex items-center justify-center min-w-0">
          {isLoaded(image) ? (
            <img
              src={`data:${image.mimeType};base64,${image.imageBase64}`}
              alt={`Style ${position.si + 1} image ${position.pi + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          ) : image && 'error' in image ? (
            <p className="text-red-400 text-sm">{image.error}</p>
          ) : (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
          )}
        </div>

        <button onClick={() => go(1)} className="text-white/70 hover:text-white p-2 shrink-0" title="Next (→)">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom panel */}
      <div className="bg-gray-900/80 px-6 py-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-gray-300 text-xs max-w-3xl mx-auto text-center line-clamp-3">{prompt}</p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={handleDownload} disabled={!isLoaded(image)} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download
          </button>
          <button onClick={() => onRegenerate(position.si, position.pi)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Regenerate
          </button>
          <button onClick={() => onToggleSelect(position.si, position.pi)} className={`text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 ${isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
            <svg className="w-4 h-4" fill={isSelected ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {isSelected ? 'Selected' : 'Select'}
          </button>
          <button onClick={handleVariants} disabled={loadingVariants} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
            {loadingVariants ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            )}
            Generate {VARIANT_COUNT} variants
          </button>
        </div>

        {/* Variants strip */}
        {(variants || loadingVariants) && (
          <div className="max-w-3xl mx-auto">
            <p className="text-gray-400 text-xs text-center mb-2">Click a variant to use it</p>
            <div className="grid grid-cols-4 gap-2">
              {(variants ?? Array.from({ length: VARIANT_COUNT }, () => null)).map((v, i) => (
                <div key={i} className="aspect-square bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                  {isLoaded(v) ? (
                    <img
                      src={`data:${v.mimeType};base64,${v.imageBase64}`}
                      alt={`Variant ${i + 1}`}
                      onClick={() => onAdopt(position.si, position.pi, { imageBase64: v.imageBase64, mimeType: v.mimeType })}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ) : v && 'error' in v ? (
                    <span className="text-red-400 text-[10px] p-1 text-center">{v.error}</span>
                  ) : (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
