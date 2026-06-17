'use client'

import { useState } from 'react'
import type { MaterialSpec, StyleData } from '@/app/types'

interface PromptReviewProps {
  styles: StyleData[]
  onPromptChange: (styleIndex: number, promptIndex: number, value: string) => void
  onMaterialsChange: (styleIndex: number, field: keyof MaterialSpec, value: string) => void
  onGenerate: () => void
  onBack: () => void
}

const FINISH_CHIPS = ['matte', 'glossy', 'brushed', 'soft-touch', 'metallic', 'textured', 'anodized']

const MATERIAL_FIELDS: { key: keyof MaterialSpec; label: string; placeholder: string }[] = [
  { key: 'primary', label: 'Primary material', placeholder: 'e.g. brushed aluminum' },
  { key: 'accent', label: 'Accent material', placeholder: 'e.g. walnut wood' },
  { key: 'finish', label: 'Finish', placeholder: 'e.g. matte' },
  { key: 'palette', label: 'Color palette', placeholder: 'e.g. warm neutrals, sand & charcoal' },
]

export default function PromptReview({ styles, onPromptChange, onMaterialsChange, onGenerate, onBack }: PromptReviewProps) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const totalPrompts = styles.reduce((sum, s) => sum + s.prompts.length, 0)

  const toggle = (i: number) => setCollapsed((c) => ({ ...c, [i]: !c[i] }))

  const inputClass =
    'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-100">Review Prompts &amp; Materials</h2>
          <span className="text-sm text-gray-400">{totalPrompts} prompts</span>
        </div>
        <p className="text-gray-400 text-sm mb-5">
          Tune the materials and edit any prompt that looks off before generating the images. The materials below are applied to every image of that style.
        </p>

        <div className="space-y-4">
          {styles.map((style, si) => (
            <div key={si} className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(si)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-750 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">Style {si + 1}</span>
                  <span className="text-white font-medium">{style.name}</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${collapsed[si] ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!collapsed[si] && (
                <div className="p-4 space-y-4">
                  <p className="text-gray-400 text-sm italic">{style.description}</p>

                  {/* Structured materials */}
                  <div className="bg-gray-750 border border-gray-700 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-300 mb-2">Materials &amp; finish</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {MATERIAL_FIELDS.map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs text-gray-400 mb-1">{label}</label>
                          <input
                            type="text"
                            value={style.materials[key]}
                            onChange={(e) => onMaterialsChange(si, key, e.target.value)}
                            placeholder={placeholder}
                            className={inputClass}
                          />
                          {key === 'finish' && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {FINISH_CHIPS.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => onMaterialsChange(si, 'finish', chip)}
                                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${style.materials.finish === chip ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500'}`}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Prompts */}
                  <div className="border-t border-gray-700 pt-3 space-y-3">
                    {style.prompts.map((prompt, pi) => (
                      <div key={pi} className="flex gap-2">
                        <span className="text-gray-500 text-xs mt-2.5 w-5 flex-shrink-0">{pi + 1}.</span>
                        <textarea
                          value={prompt}
                          onChange={(e) => onPromptChange(si, pi, e.target.value)}
                          rows={2}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-between">
          <button
            type="button"
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            ← Back to brief
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
          >
            Generate {totalPrompts} Images →
          </button>
        </div>
      </div>
    </div>
  )
}
