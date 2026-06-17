'use client'

import { useState } from 'react'
import { aspectClass, type AspectRatio, type ImageSlot } from '@/app/types'

interface ImageCardProps {
  prompt: string
  image: ImageSlot
  index: number
  aspectRatio: AspectRatio
  filename: string
  selected: boolean
  onRegenerate: () => void
  onOpen: () => void
  onToggleSelect: () => void
  disabled?: boolean
}

export default function ImageCard({
  prompt,
  image,
  index,
  aspectRatio,
  filename,
  selected,
  onRegenerate,
  onOpen,
  onToggleSelect,
  disabled,
}: ImageCardProps) {
  const [regenerating, setRegenerating] = useState(false)
  const isLoaded = image !== null && 'imageBase64' in image
  const isFailed = image !== null && 'error' in image
  const isLoading = image === null

  const handleRegenerate = async () => {
    if (regenerating || disabled) return
    setRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      setRegenerating(false)
    }
  }

  const handleDownload = () => {
    if (!isLoaded) return
    const ext = image.mimeType.split('/')[1] || 'png'
    const a = document.createElement('a')
    a.href = `data:${image.mimeType};base64,${image.imageBase64}`
    a.download = `${filename}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className={`relative group ${aspectClass(aspectRatio)} bg-gray-700 rounded-lg overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {isLoaded ? (
        <>
          <img
            src={`data:${image.mimeType};base64,${image.imageBase64}`}
            alt={`Generated image ${index + 1}`}
            onClick={onOpen}
            className="w-full h-full object-cover cursor-zoom-in"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-between pointer-events-none">
            <div className="flex justify-end gap-1.5 pointer-events-auto">
              <button onClick={handleDownload} title="Download this image" className="bg-white/15 hover:bg-white/30 text-white rounded p-1.5 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button onClick={handleRegenerate} disabled={regenerating || disabled} title="Regenerate this image" className="bg-white/15 hover:bg-white/30 text-white rounded p-1.5 transition-colors disabled:opacity-50">
                <svg className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <p onClick={onOpen} className="text-white text-xs leading-relaxed line-clamp-4 pointer-events-auto cursor-zoom-in">{prompt}</p>
          </div>
        </>
      ) : isFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400 text-xs text-center line-clamp-3">{image.error}</p>
          <button onClick={handleRegenerate} disabled={regenerating || disabled} className="mt-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1">
            <svg className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <div className="animate-pulse w-8 h-8 bg-gray-600 rounded-full" />
          <p className="text-gray-500 text-xs text-center px-2 line-clamp-3">{prompt.substring(0, 60)}...</p>
        </div>
      )}

      {/* Select / favorite toggle */}
      {isLoaded && (
        <button
          onClick={onToggleSelect}
          title={selected ? 'Deselect' : 'Select for download'}
          className={`absolute top-2 left-2 rounded-full p-1 transition-colors ${selected ? 'bg-blue-500 text-white' : 'bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-black/70'}`}
        >
          <svg className="w-4 h-4" fill={selected ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )}

      {!isLoading && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded group-hover:opacity-0 transition-opacity">
          {index + 1}
        </div>
      )}
    </div>
  )
}
