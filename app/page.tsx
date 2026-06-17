'use client'

import { useState } from 'react'
import PromptForm from '@/components/PromptForm'
import PromptReview from '@/components/PromptReview'
import StyleSection from '@/components/StyleSection'
import DownloadButton from '@/components/DownloadButton'
import Lightbox from '@/components/Lightbox'
import {
  ADV_SHOTS,
  EMPTY_MATERIALS,
  isLoaded,
  type BriefData,
  type ImageRef,
  type ImageSlot,
  type MaterialSpec,
  type StyleData,
} from '@/app/types'

const keyOf = (si: number, pi: number) => `${si}-${pi}`

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
  const [progressTotal, setProgressTotal] = useState(0)
  const [error, setError] = useState<string>('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [lightbox, setLightbox] = useState<{ si: number; pi: number } | null>(null)

  const selectedCount = Object.values(selected).filter(Boolean).length

  const setSlot = (si: number, pi: number, slot: ImageSlot) => {
    setStyles((prev) => {
      const next = prev.map((s) => ({ ...s, images: [...s.images] }))
      next[si].images[pi] = slot
      return next
    })
  }

  // Builds the structured request body for one image of a given style.
  // Styles with a referenceOverride (e.g. advertising sets) lock onto that
  // exact product image and let the prompt drive the scene; other styles use
  // the global brief reference/background.
  const requestBodyForStyle = (style: StyleData, prompt: string) => {
    const override = style.referenceOverride
    return {
      prompt,
      materials: style.materials,
      aspectRatio: briefData?.aspectRatio ?? '1:1',
      manufacturing: briefData?.manufacturing ?? null,
      reference: override
        ? { image: override, mode: 'exact' as const, adapt: { moveNozzles: false, changeButtons: false, modifyLights: false, generateProposals: false, notes: '' } }
        : briefData?.reference?.image
          ? { image: briefData.reference.image, mode: briefData.reference.mode, adapt: briefData.reference.adapt }
          : null,
      background: override
        ? null
        : briefData?.background
          ? { description: briefData.background.description, image: briefData.background.image }
          : null,
    }
  }

  // Generate a single slot's image and return the resulting ImageSlot (no state mutation).
  const generateSlotFrom = async (style: StyleData, pi: number): Promise<ImageSlot> => {
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBodyForStyle(style, style.prompts[pi])),
      })
      const data = await readJsonSafe(res)
      return data.imageBase64 && !data.error
        ? { imageBase64: data.imageBase64 as string, mimeType: data.mimeType as string }
        : { error: (data.error as string) || 'No image returned' }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Request failed' }
    }
  }

  const generateSlot = (si: number, pi: number): Promise<ImageSlot> => {
    const style = styles[si]
    if (!style) return Promise.resolve({ error: 'Missing style' })
    return generateSlotFrom(style, pi)
  }

  // Core batched generation. Fills the given target slots (reading prompts /
  // reference from `source`) and writes each result straight into state.
  const runBatchGeneration = async (
    source: StyleData[],
    targets: Array<{ si: number; pi: number }>,
    label: string
  ) => {
    setIsWorking(true)
    setError('')
    setProgress(0)
    setProgressTotal(targets.length)
    const batchSize = 4
    let completed = 0
    try {
      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize)
        setStatus(`${label} ${completed + 1}–${Math.min(completed + batchSize, targets.length)} / ${targets.length}`)
        const results = await Promise.allSettled(batch.map(({ si, pi }) => generateSlotFrom(source[si], pi)))
        results.forEach((r, k) => {
          const { si, pi } = batch[k]
          setSlot(si, pi, r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : 'Request failed' })
          completed++
        })
        setProgress(completed)
      }
      setStatus('Done!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsWorking(false)
    }
  }

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
    setPhase('images')
    const working = styles.map((s) => ({ ...s, images: new Array(s.prompts.length).fill(null) as ImageSlot[] }))
    setStyles(working)
    const targets = working.flatMap((style, si) => style.prompts.map((_, pi) => ({ si, pi })))
    await runBatchGeneration(working, targets, 'Generating images')
  }

  // From flagged images, build advertising sets (varied framing & settings) of
  // the same product, using each selected image as the exact reference.
  const handleCreateAdv = async () => {
    const sources: Array<{ image: ImageRef; styleName: string; materials: MaterialSpec; index: number }> = []
    styles.forEach((style, si) => {
      style.images.forEach((img, pi) => {
        if (selected[keyOf(si, pi)] && isLoaded(img)) {
          sources.push({
            image: { data: img.imageBase64, mimeType: img.mimeType },
            styleName: style.name,
            materials: style.materials,
            index: sources.length + 1,
          })
        }
      })
    })
    if (sources.length === 0) return

    const advBlocks: StyleData[] = sources.map((src) => ({
      name: `ADV — ${src.styleName} #${src.index}`,
      description: 'Advertising shots · varied framing & settings of the same product',
      materials: src.materials,
      prompts: ADV_SHOTS.map((shot) => `Professional advertising photograph of the product. ${shot}.`),
      images: new Array(ADV_SHOTS.length).fill(null),
      referenceOverride: src.image,
      isAdv: true,
    }))

    const baseLen = styles.length
    const next = [...styles, ...advBlocks]
    setStyles(next)
    setSelected({})

    const targets = advBlocks.flatMap((blk, i) => blk.prompts.map((_, pi) => ({ si: baseLen + i, pi })))
    await runBatchGeneration(next, targets, 'Creating ADV shots')

    // scroll to the new section
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
  }

  // Regenerate a single image (used from each card / lightbox)
  const handleRegenerate = async (si: number, pi: number) => {
    setSlot(si, pi, null) // show loading
    setSlot(si, pi, await generateSlot(si, pi))
  }

  // Generate N fresh variants of one prompt without touching the grid.
  const handleGenerateVariants = async (si: number, pi: number, count: number): Promise<ImageSlot[]> => {
    return Promise.all(Array.from({ length: count }, () => generateSlot(si, pi)))
  }

  // Adopt a chosen variant into the grid slot.
  const handleAdopt = (si: number, pi: number, image: { imageBase64: string; mimeType: string }) => {
    setSlot(si, pi, image)
  }

  const toggleSelect = (si: number, pi: number) =>
    setSelected((prev) => ({ ...prev, [keyOf(si, pi)]: !prev[keyOf(si, pi)] }))

  const selectAll = () => {
    const all: Record<string, boolean> = {}
    styles.forEach((s, si) => s.images.forEach((img, pi) => {
      if (img && 'imageBase64' in img) all[keyOf(si, pi)] = true
    }))
    setSelected(all)
  }

  const clearSelection = () => setSelected({})

  const handleReset = () => {
    setPhase('input')
    setStyles([])
    setStatus('')
    setError('')
    setProgress(0)
    setProgressTotal(0)
    setSelected({})
    setLightbox(null)
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
            {phase === 'images' && isWorking && progressTotal > 0 && (
              <div className="mt-3 max-w-md mx-auto">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress / progressTotal) * 100}%` }}
                  />
                </div>
                <p className="text-gray-400 text-xs mt-1">{progress} / {progressTotal} images</p>
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
              <div className="mt-8 flex flex-wrap justify-center items-center gap-3">
                <DownloadButton styles={styles} selected={selected} />
                {selectedCount > 0 && (
                  <button
                    onClick={handleCreateAdv}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-5 rounded-lg transition-colors text-sm flex items-center gap-2"
                    title={`Generate ${ADV_SHOTS.length} advertising shots per selected design`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Create ADV set ({selectedCount}×{ADV_SHOTS.length})
                  </button>
                )}
                <button
                  onClick={selectedCount > 0 ? clearSelection : selectAll}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-5 rounded-lg transition-colors text-sm"
                >
                  {selectedCount > 0 ? `Clear selection (${selectedCount})` : 'Select all'}
                </button>
                <button
                  onClick={handleBackToReview}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-5 rounded-lg transition-colors text-sm"
                >
                  ← Edit Prompts
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-5 rounded-lg transition-colors text-sm"
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
                  aspectRatio={briefData?.aspectRatio ?? '1:1'}
                  onRegenerate={handleRegenerate}
                  onOpen={(si, pi) => setLightbox({ si, pi })}
                  onToggleSelect={toggleSelect}
                  selected={selected}
                  busy={isWorking}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <Lightbox
          styles={styles}
          position={lightbox}
          aspectRatio={briefData?.aspectRatio ?? '1:1'}
          selected={selected}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
          onRegenerate={handleRegenerate}
          onToggleSelect={toggleSelect}
          onGenerateVariants={handleGenerateVariants}
          onAdopt={handleAdopt}
        />
      )}
    </main>
  )
}
