'use client'

import { useState } from 'react'
import ImageCard from './ImageCard'
import { isLoaded, materialsToLabel, type StyleData } from '@/app/types'

interface StyleSectionProps {
  style: StyleData
  styleIndex: number
  onRegenerate: (styleIndex: number, promptIndex: number) => void
  busy?: boolean
}

export default function StyleSection({ style, styleIndex, onRegenerate, busy }: StyleSectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  const loadedCount = style.images.filter(isLoaded).length
  const materialsLabel = materialsToLabel(style.materials)
  const safeName = style.name.replace(/\s+/g, '_')

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
            Style {styleIndex + 1}
          </span>
          <div className="text-left">
            <h3 className="text-white font-semibold">{style.name}</h3>
            <p className="text-gray-400 text-sm">{style.description}</p>
            {materialsLabel && <p className="text-gray-500 text-xs mt-0.5">Materials: {materialsLabel}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{loadedCount}/{style.prompts.length}</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {style.prompts.map((prompt, pi) => (
              <ImageCard
                key={pi}
                prompt={prompt}
                image={style.images[pi]}
                index={pi}
                filename={`style${styleIndex + 1}_${safeName}_${pi + 1}`}
                onRegenerate={() => onRegenerate(styleIndex, pi)}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
