'use client'

import { useState } from 'react'
import PromptForm from '@/components/PromptForm'
import PromptReview from '@/components/PromptReview'
import StyleSection from '@/components/StyleSection'
import DownloadButton from '@/components/DownloadButton'
import {
  EMPTY_MATERIALS,
  type BriefData,
  type ImageSlot,
  type MaterialSpec,
  type StyleData,
} from '@/app/types'

type Phase = 'input' | 'review' | 'images'

// Reads a response body as JSON, but tolerates non-JSON bodies such as the
// plain-text error pages Vercel returns when a serverless function times out
// or crashes (e.g. "An error occurred with your deployment / FUNCTION_INVOCATION_TIMEOUT").
// Without this, res.json() throws an opaque "Unexpected token ... is not valid JSON".
async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    const snippet = text.trim().split('\n').map((l) => l.trim()).filter(Boolean).join(' — ').slice(0, 200)
    return { error: snippet || `Request failed (${res.status} ${res.statusText})` }
  }
}

// Materials may arrive as a structured object or (older shape) a string.
function normalizeMaterials(raw: unknown): MaterialSpec {
  if (raw && typeof raw === 'object') {
    const m = raw as Partial<MaterialSpec>
    return {
      primary: m.primary ?? '',
      accent: m.accent ?? '',
      finish: m.finish ?? '',
      palette: m.palette ?? '',
    }
  }
  if (typeof raw === 'string') return { ...EMPTY_MATERIALS, primary: raw }
  return { ...EMPTY_MATERIALS }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input')
  const [briefData, setBriefData] = useState<BriefData | null>(null)
  const [styles, setStyles] = useState<StyleData[]>([])
  const [status, setStatus] = useState<string>('')
  const [isWorking, setIsWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>('')

  const totalImages = styles.reduce((sum, s) => sum + s.prompts.length, 0)

  // Builds the structured request body for a single image generation.
  const imageRequestBody = (brief: BriefData | null, prompt: string, materials: MaterialSpec) => ({
    prompt,
    materials,
    reference: brief?.reference?.image
      ? { image: brief.reference.image, mode: brief.reference.mode, adapt: brief.reference.adapt }
      : null,
    background: brief?.background
      ? { description: brief.background.description, image: brief.background.image }
      : null,
  })

  // Step 1 — generate prompts, then show the review screen
  const handleGeneratePrompts = async (data: BriefData) => {
    setIsWorking(true)
    setError('')
    setStyles([])
    setBriefData(data)
    setStatus('Generating prompts...')

    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errData = await readJsonSafe(res)
        throw new Error((errData.error as string) || `Failed to generate prompts (${res.status})`)
      }

      const promptsData = await readJsonSafe(res)
      const rawStyles = promptsData.styles as Array<{ name: string; description: string; materials?: unknown; prompts: string[] }> | undefined
      if (!Array.isArray(rawStyles)) {
        throw new Error((promptsData.error as string) || 'Invalid response from prompt generation')
      }

      setStyles(
        rawStyles.map((s) => ({
          name: s.name,
          description: s.description,
          materials: normalizeMaterials(s.materials),
          prompts: s.prompts,
          images: new Array(s.prompts.length).fill(null),
        }))
      )
      setStatus('')
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsWorking(false)
    }
  }

  const handlePromptChange = (styleIndex: number, promptIndex: number, value: string) => {
    setStyles((prev) => {
      const next = prev.map((s) => ({ ...s, prompts: [...s.prompts] }))
      next[styleIndex].prompts[promptIndex] = value
      return next
    })
  }

  const handleMaterialsChange = (styleIndex: number, field: keyof MaterialSpec, value: string) => {
    setStyles((prev) => {
      const next = prev.map((s) => ({ ...s, materials: { ...s.materials } }))
      next[styleIndex].materials[field] = value
      return next
    })
  }

  // Step 2 — generate images from the (possibly edited) prompts
  const handleGenerateImages = async () => {
    setIsWorking(true)
    setError('')
    setProgress(0)
    setPhase('images')

    const working = styles.map((s) => ({ ...s, images: new Array(s.prompts.length).fill(null) as ImageSlot[] }))
    setStyles(working)

    const jobs: Array<{ styleIndex: number; promptIndex: number; prompt: string; materials: MaterialSpec }> = []
    working.forEach((style, si) => {
      style.prompts.forEach((prompt, pi) => {
        jobs.push({ styleIndex: si, promptIndex: pi, prompt, materials: style.materials })
      })
    })

    const total = jobs.length
    const batchSize = 4
    let completed = 0

    try {
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize)
        setStatus(`Generating images ${completed + 1}–${Math.min(completed + batchSize, total)} / ${total}`)

        const batchResults = await Promise.allSettled(
          batch.map(async ({ prompt, materials }) => {
            const res = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(imageRequestBody(briefData, prompt, materials)),
            })
            return readJsonSafe(res)
          })
        )

        batchResults.forEach((result, ri) => {
          const { styleIndex, promptIndex } = batch[ri]
          if (result.status === 'fulfilled') {
            const data = result.value
            if (data.imageBase64 && !data.error) {
              working[styleIndex].images[promptIndex] = {
                imageBase64: data.imageBase64 as string,
                mimeType: data.mimeType as string,
              }
            } else {
              working[styleIndex].images[promptIndex] = { error: (data.error as string) || 'No image returned' }
            }
          } else {
            working[styleIndex].images[promptIndex] = {
              error: result.reason instanceof Error ? result.reason.message : 'Request failed',
            }
          }
          completed++
        })

        setProgress(completed)
        setStyles(working.map((s) => ({ ...s, images: [...s.images] })))
      }

      setStatus('Done!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsWorking(false)
    }
  }

  // Regenerate a single image (used from each card)
  const handleRegenerate = async (styleIndex: number, promptIndex: number) => {
    const style = styles[styleIndex]
    if (!style) return
    const prompt = style.prompts[promptIndex]

    // mark this slot as loading
    setStyles((prev) => {
      const next = prev.map((s) => ({ ...s, images: [...s.images] }))
      next[styleIndex].images[promptIndex] = null
      return next
    })

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageRequestBody(briefData, prompt, style.materials)),
      })
      const data = await readJsonSafe(res)
      setStyles((prev) => {
        const next = prev.map((s) => ({ ...s, images: [...s.images] }))
        next[styleIndex].images[promptIndex] =
          data.imageBase64 && !data.error
            ? { imageBase64: data.imageBase64 as string, mimeType: data.mimeType as string }
            : { error: (data.error as string) || 'No image returned' }
        return next
      })
    } catch (err) {
      setStyles((prev) => {
        const next = prev.map((s) => ({ ...s, images: [...s.images] }))
        next[styleIndex].images[promptIndex] = { error: err instanceof Error ? err.message : 'Request failed' }
        return next
      })
    }
  }

  const handleReset = () => {
    setPhase('input')
    setStyles([])
    setStatus('')
    setError('')
    setProgress(0)
  }

  const handleBackToReview = () => {
    setPhase('review')
    setStatus('')
    setError('')
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">BatchVision</h1>
          <p className="text-gray-400 text-lg">AI Product Design Studio</p>
          <p className="text-gray-500 text-sm mt-1">Generate product design concepts from a brief or a real product photo, with Google Gemini</p>
        </div>

        {phase === 'input' && (
          <PromptForm onGeneratePrompts={handleGeneratePrompts} isWorking={isWorking} />
        )}

        {phase === 'review' && (
          <PromptReview
            styles={styles}
            onPromptChange={handlePromptChange}
            onMaterialsChange={handleMaterialsChange}
            onGenerate={handleGenerateImages}
            onBack={handleReset}
          />
        )}

        {(isWorking || (status && phase === 'images')) && !error && (
          <div className="mt-6 text-center">
            <p className="text-blue-400 text-sm font-medium">{status}</p>
            {phase === 'images' && isWorking && totalImages > 0 && (
              <div className="mt-3 max-w-md mx-auto">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress / totalImages) * 100}%` }}
                  />
                </div>
                <p className="text-gray-400 text-xs mt-1">{progress} / {totalImages} images</p>
              </div>
            )}
            {isWorking && (
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

        {phase === 'images' && styles.length > 0 && (
          <>
            {!isWorking && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <DownloadButton styles={styles} />
                <button
                  onClick={handleBackToReview}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  ← Edit Prompts
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  New Brief
                </button>
              </div>
            )}

            <div className="mt-10 space-y-8">
              {styles.map((style, index) => (
                <StyleSection
                  key={index}
                  style={style}
                  styleIndex={index}
                  onRegenerate={handleRegenerate}
                  busy={isWorking}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
