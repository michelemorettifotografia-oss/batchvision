'use client'

import { useState } from 'react'
import PromptForm from '@/components/PromptForm'
import StyleSection from '@/components/StyleSection'
import DownloadButton from '@/components/DownloadButton'

export interface StyleData {
  name: string
  description: string
  prompts: string[]
  images: Array<{ imageBase64: string; mimeType: string } | null>
}

export default function Home() {
  const [styles, setStyles] = useState<StyleData[]>([])
  const [status, setStatus] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>('')

  const handleGenerate = async (machine: string, brief: string, setting: string) => {
    setIsGenerating(true)
    setError('')
    setStyles([])
    setProgress(0)

    try {
      setStatus('Generating prompts...')
      const promptsRes = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine, brief, setting }),
      })

      if (!promptsRes.ok) {
        const errData = await promptsRes.json()
        throw new Error(errData.error || 'Failed to generate prompts')
      }

      const promptsData = await promptsRes.json()
      const generatedStyles: StyleData[] = promptsData.styles.map((s: { name: string; description: string; prompts: string[] }) => ({
        ...s,
        images: new Array(s.prompts.length).fill(null),
      }))
      setStyles([...generatedStyles])

      const allPrompts: Array<{ styleIndex: number; promptIndex: number; prompt: string }> = []
      generatedStyles.forEach((style, si) => {
        style.prompts.forEach((prompt, pi) => {
          allPrompts.push({ styleIndex: si, promptIndex: pi, prompt })
        })
      })

      const batchSize = 4
      let completed = 0

      for (let i = 0; i < allPrompts.length; i += batchSize) {
        const batch = allPrompts.slice(i, i + batchSize)
        setStatus(`Generating images ${completed + 1}–${Math.min(completed + batchSize, allPrompts.length)} / 40`)

        const batchResults = await Promise.allSettled(
          batch.map(async ({ styleIndex, promptIndex, prompt }) => {
            const res = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
            const data = await res.json()
            return { styleIndex, promptIndex, data }
          })
        )

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { styleIndex, promptIndex, data } = result.value
            generatedStyles[styleIndex].images[promptIndex] = data.error ? null : data
          }
          completed++
        })

        setProgress(completed)
        setStyles([...generatedStyles])
      }

      setStatus('Done!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const allImages = styles.flatMap((style, si) =>
    style.images
      .map((img, pi) => img ? { ...img, filename: `style${si + 1}_${style.name.replace(/\s+/g, '_')}_${pi + 1}` } : null)
      .filter((x): x is { imageBase64: string; mimeType: string; filename: string } => x !== null)
  )

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">BatchVision</h1>
          <p className="text-gray-400 text-lg">AI Product Design Studio</p>
          <p className="text-gray-500 text-sm mt-1">Generate 40 product design images across 5 styles using Google Gemini</p>
        </div>

        <PromptForm onGenerate={handleGenerate} isGenerating={isGenerating} />

        {(isGenerating || status) && !error && (
          <div className="mt-6 text-center">
            <p className="text-blue-400 text-sm font-medium">{status}</p>
            {isGenerating && (
              <div className="mt-3 max-w-md mx-auto">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress / 40) * 100}%` }}
                  />
                </div>
                <p className="text-gray-400 text-xs mt-1">{progress} / 40 images</p>
              </div>
            )}
            {isGenerating && (
              <div className="mt-3 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {allImages.length > 0 && !isGenerating && (
          <div className="mt-8 flex justify-center">
            <DownloadButton images={allImages} />
          </div>
        )}

        {styles.length > 0 && (
          <div className="mt-10 space-y-8">
            {styles.map((style, index) => (
              <StyleSection key={index} style={style} styleIndex={index} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
