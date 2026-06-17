'use client'

import { useState } from 'react'
import TagSelector from './TagSelector'
import {
  ASPECT_RATIOS,
  BACKGROUND_PRESETS,
  DEFAULT_ADAPT,
  DEFAULT_MANUFACTURING,
  DESIGN_STYLE_PRESETS,
  MANUFACTURING_PROCESSES,
  type AdaptOptions,
  type AspectRatio,
  type BriefData,
  type ImageRef,
  type ManufacturingConfig,
  type ReferenceMode,
} from '@/app/types'

interface PromptFormProps {
  onGeneratePrompts: (brief: BriefData) => void
  isWorking: boolean
}

interface UploadedImage extends ImageRef {
  preview: string
}

function readImageFile(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, data] = result.split(',')
      resolve({ data, mimeType: file.type, preview: result })
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function PromptForm({ onGeneratePrompts, isWorking }: PromptFormProps) {
  const [machine, setMachine] = useState('')
  const [brief, setBrief] = useState('')
  const [setting, setSetting] = useState('')
  const [constraints, setConstraints] = useState('')
  const [styleCount, setStyleCount] = useState(5)
  const [promptsPerStyle, setPromptsPerStyle] = useState(8)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [designStyles, setDesignStyles] = useState<string[]>([])
  const [manufacturing, setManufacturing] = useState<ManufacturingConfig>(DEFAULT_MANUFACTURING)

  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null)
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('exact')
  const [adapt, setAdapt] = useState<AdaptOptions>(DEFAULT_ADAPT)

  const [bgPreset, setBgPreset] = useState('')
  const [bgImage, setBgImage] = useState<UploadedImage | null>(null)

  const [fileError, setFileError] = useState('')

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (img: UploadedImage | null) => void
  ) => {
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
    try {
      setter(await readImageFile(file))
    } catch {
      setFileError('Could not read that image')
    }
  }

  const toggleAdapt = (key: keyof AdaptOptions) =>
    setAdapt((a) => ({ ...a, [key]: !a[key as keyof AdaptOptions] }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!machine.trim() || !brief.trim() || !setting.trim()) return

    const presetDesc = BACKGROUND_PRESETS.find((p) => p.key === bgPreset)?.description ?? ''

    onGeneratePrompts({
      machine: machine.trim(),
      brief: brief.trim(),
      setting: setting.trim(),
      constraints: constraints.trim(),
      styleCount: Math.max(styleCount, designStyles.length),
      promptsPerStyle,
      aspectRatio,
      designStyles,
      manufacturing,
      reference: {
        image: referenceImage ? { data: referenceImage.data, mimeType: referenceImage.mimeType } : null,
        mode: referenceMode,
        adapt,
      },
      background: {
        preset: bgPreset,
        description: presetDesc,
        image: bgImage ? { data: bgImage.data, mimeType: bgImage.mimeType } : null,
      },
    })
  }

  const inputClass =
    'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-3xl mx-auto space-y-8">
      {/* ---- Brief ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Product Design Brief</h2>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Machine Type</label>
          <input
            type="text"
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            placeholder="e.g. Industrial espresso machine, Electric cargo bike, CNC milling machine"
            className={inputClass}
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
            className={`${inputClass} resize-none`}
            disabled={isWorking}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Setting &amp; Orientation</label>
          <input
            type="text"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="e.g. Modern kitchen countertop, front 3/4 view, natural daylight"
            className={inputClass}
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
            className={inputClass}
            disabled={isWorking}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Styles: {styleCount}</label>
            <input type="range" min={1} max={8} value={styleCount} onChange={(e) => setStyleCount(Number(e.target.value))} disabled={isWorking} className="w-full accent-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Images / style: {promptsPerStyle}</label>
            <input type="range" min={1} max={12} value={promptsPerStyle} onChange={(e) => setPromptsPerStyle(Number(e.target.value))} disabled={isWorking} className="w-full accent-blue-500" />
          </div>
        </div>
        <p className="text-gray-500 text-xs">{styleCount * promptsPerStyle} images will be generated in total.</p>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Aspect ratio</label>
          <div className="grid grid-cols-3 gap-2">
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setAspectRatio(r.value)}
                disabled={isWorking}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${aspectRatio === r.value ? 'border-blue-500 bg-blue-600/20' : 'border-gray-600 bg-gray-700 hover:border-gray-500'}`}
              >
                <span className="block text-sm font-medium text-white">{r.label}</span>
                <span className="block text-xs text-gray-400">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Design styles ---- */}
      <section className="space-y-3 border-t border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-200">Design Styles <span className="text-gray-500 font-normal">(optional)</span></h3>
        <p className="text-gray-500 text-xs">
          Pick the styles to explore, or add your own. Selected styles are used first; the rest are filled by AI up to the style count
          {designStyles.length > 0 ? ` (${designStyles.length} selected)` : ''}.
        </p>
        <TagSelector
          presets={DESIGN_STYLE_PRESETS}
          value={designStyles}
          onChange={setDesignStyles}
          placeholder="Add a custom style (e.g. Scandinavian farmhouse)"
          disabled={isWorking}
        />
      </section>

      {/* ---- Manufacturing feasibility ---- */}
      <section className="space-y-3 border-t border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-200">Manufacturing &amp; Materials Tech <span className="text-gray-500 font-normal">(optional)</span></h3>
        <p className="text-gray-500 text-xs">
          Keep designs producible. Pick the processes you can use so the AI favors feasible geometries and materials instead of costly tooling.
        </p>
        <TagSelector
          presets={MANUFACTURING_PROCESSES}
          value={manufacturing.processes}
          onChange={(processes) => setManufacturing((m) => ({ ...m, processes }))}
          placeholder="Add a process (e.g. roto-molding)"
          disabled={isWorking}
        />
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={manufacturing.avoidExpensiveTooling}
            onChange={(e) => setManufacturing((m) => ({ ...m, avoidExpensiveTooling: e.target.checked }))}
            disabled={isWorking}
            className="accent-blue-500"
          />
          Avoid expensive tooling (large injection molds, complex multi-axis machining)
        </label>
        <input
          type="text"
          value={manufacturing.notes}
          onChange={(e) => setManufacturing((m) => ({ ...m, notes: e.target.value }))}
          placeholder="Manufacturing notes (e.g. max 3 unique molded parts, prefer standard extrusion profiles)"
          className={`${inputClass} text-sm`}
          disabled={isWorking}
        />
      </section>

      {/* ---- Reference product ---- */}
      <section className="space-y-3 border-t border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-200">Product Reference <span className="text-gray-500 font-normal">(optional)</span></h3>
        {referenceImage ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImage.preview} alt="Reference" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
            <button type="button" onClick={() => setReferenceImage(null)} disabled={isWorking} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50">
              Remove
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-dashed border-gray-600 rounded-lg px-4 py-3 text-gray-400 cursor-pointer hover:border-blue-500 hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Upload product photo</span>
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setReferenceImage)} disabled={isWorking} className="hidden" />
          </label>
        )}

        {referenceImage && (
          <div className="space-y-3 bg-gray-750 rounded-lg p-4 border border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReferenceMode('exact')}
                disabled={isWorking}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${referenceMode === 'exact' ? 'border-blue-500 bg-blue-600/20' : 'border-gray-600 bg-gray-700 hover:border-gray-500'}`}
              >
                <span className="block text-sm font-medium text-white">Exact replica</span>
                <span className="block text-xs text-gray-400">Identical product, only restyle materials &amp; scene</span>
              </button>
              <button
                type="button"
                onClick={() => setReferenceMode('adapt')}
                disabled={isWorking}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${referenceMode === 'adapt' ? 'border-blue-500 bg-blue-600/20' : 'border-gray-600 bg-gray-700 hover:border-gray-500'}`}
              >
                <span className="block text-sm font-medium text-white">Adapt &amp; explore</span>
                <span className="block text-xs text-gray-400">Keep proportions, allow design changes</span>
              </button>
            </div>

            {referenceMode === 'adapt' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Allowed modifications:</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['moveNozzles', 'Move nozzles / spouts'],
                    ['changeButtons', 'Change buttons / controls'],
                    ['modifyLights', 'Modify lights / indicators'],
                    ['generateProposals', 'Bolder design proposals'],
                  ] as [keyof AdaptOptions, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adapt[key] as boolean}
                        onChange={() => toggleAdapt(key)}
                        disabled={isWorking}
                        className="accent-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={adapt.notes}
                  onChange={(e) => setAdapt((a) => ({ ...a, notes: e.target.value }))}
                  placeholder="Extra direction (e.g. make it 20% slimmer, add a handle)"
                  className={`${inputClass} text-sm`}
                  disabled={isWorking}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Background ---- */}
      <section className="space-y-3 border-t border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-200">Background / Scene <span className="text-gray-500 font-normal">(optional)</span></h3>
        {bgImage ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImage.preview} alt="Background" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
            <div className="text-sm">
              <p className="text-gray-300">Custom background uploaded</p>
              <button type="button" onClick={() => setBgImage(null)} disabled={isWorking} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBgPreset('')}
                disabled={isWorking}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${bgPreset === '' ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'}`}
              >
                None
              </button>
              {BACKGROUND_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setBgPreset(p.key)}
                  disabled={isWorking}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${bgPreset === p.key ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-dashed border-gray-600 rounded-lg px-4 py-2.5 text-gray-400 cursor-pointer hover:border-blue-500 hover:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">…or upload a custom background</span>
              <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setBgImage)} disabled={isWorking} className="hidden" />
            </label>
          </>
        )}
      </section>

      {fileError && <p className="text-red-400 text-xs">{fileError}</p>}

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
    </form>
  )
}
