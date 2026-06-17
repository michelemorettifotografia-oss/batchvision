'use client'

import { useState } from 'react'
import type { BriefData } from '@/app/page'

interface PromptFormProps {
  onGeneratePrompts: (brief: BriefData) => void
  isWorking: boolean
}

export default function PromptForm({ onGeneratePrompts, isWorking }: PromptFormProps) {
  const [machine, setMachine] = useState('')
  const [brief, setBrief] = useState('')
  const [setting, setSetting] = useState('')
  const [constraints, setConstraints] = useState('')
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null)
  const [fileError, setFileError] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('Please select an image file')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setFileError('Image too large (max 8 MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, data] = result.split(',')
      setReferenceImage({ data, mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (machine.trim() && brief.trim() && setting.trim()) {
      onGeneratePrompts({
        machine: machine.trim(),
        brief: brief.trim(),
        setting: setting.trim(),
        constraints: constraints.trim(),
        referenceImage: referenceImage ? { data: referenceImage.data, mimeType: referenceImage.mimeType } : null,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-100 mb-5">Product Design Brief</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Machine Type</label>
          <input
            type="text"
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            placeholder="e.g. Industrial espresso machine, Electric cargo bike, CNC milling machine"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isWorking}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Brief / Focus</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Premium consumer version with minimal aesthetic, focus on sustainability and premium materials"
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isWorking}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Setting & Orientation</label>
          <input
            type="text"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="e.g. Modern kitchen countertop, front 3/4 view, natural daylight"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isWorking}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Avoid / Constraints <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="e.g. no people, no text or logos, no busy backgrounds, no plastic"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isWorking}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Product Reference Image <span className="text-gray-500 font-normal">(optional — keeps every shot on the real product)</span>
          </label>
          {referenceImage ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referenceImage.preview} alt="Reference" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
              <button
                type="button"
                onClick={() => setReferenceImage(null)}
                disabled={isWorking}
                className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-dashed border-gray-600 rounded-lg px-4 py-3 text-gray-400 cursor-pointer hover:border-blue-500 hover:text-gray-300 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Upload product photo</span>
              <input type="file" accept="image/*" onChange={handleFile} disabled={isWorking} className="hidden" />
            </label>
          )}
          {fileError && <p className="text-red-400 text-xs mt-1">{fileError}</p>}
        </div>
      </div>
      <div className="mt-6">
        <button
          type="submit"
          disabled={isWorking || !machine.trim() || !brief.trim() || !setting.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isWorking ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Working...
            </>
          ) : (
            'Generate Prompts →'
          )}
        </button>
      </div>
    </form>
  )
}
