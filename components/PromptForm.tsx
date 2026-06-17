'use client'

import { useState } from 'react'

interface PromptFormProps {
  onGenerate: (machine: string, brief: string, setting: string) => void
  isGenerating: boolean
}

export default function PromptForm({ onGenerate, isGenerating }: PromptFormProps) {
  const [machine, setMachine] = useState('')
  const [brief, setBrief] = useState('')
  const [setting, setSetting] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (machine.trim() && brief.trim() && setting.trim()) {
      onGenerate(machine.trim(), brief.trim(), setting.trim())
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
            disabled={isGenerating}
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
            disabled={isGenerating}
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
            disabled={isGenerating}
            required
          />
        </div>
      </div>
      <div className="mt-6">
        <button
          type="submit"
          disabled={isGenerating || !machine.trim() || !brief.trim() || !setting.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Generating...
            </>
          ) : (
            'Generate 40 Images'
          )}
        </button>
      </div>
    </form>
  )
}
