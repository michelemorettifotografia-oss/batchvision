'use client'

import { useState } from 'react'
import {
  ASPECT_RATIOS,
  BACKGROUND_PRESETS,
  QUALITY_TIERS,
  SHOT_PRESETS,
  estimateEur,
  type AspectRatio,
  type ImageRef,
  type QualityTier,
  type ReshootData,
} from '@/app/types'

interface ReshootFormProps {
  onGenerate: (data: ReshootData) => void
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

export default function ReshootForm({ onGenerate, isWorking }: ReshootFormProps) {
  const [photos, setPhotos] = useState<UploadedImage[]>([])
  const [selectedShots, setSelectedShots] = useState<string[]>(SHOT_PRESETS.map((s) => s.key))
  const [bgPreset, setBgPreset] = useState('')
  const [customBgText, setCustomBgText] = useState('')
  const [bgImage, setBgImage] = useState<UploadedImage | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [quality, setQuality] = useState<QualityTier>('budget')
  const [fileError, setFileError] = useState('')

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const valid = files.filter((f) => f.type.startsWith('image/') && f.size <= 8 * 1024 * 1024)
    if (valid.length < files.length) setFileError('Some files were skipped (not an image, or over 8 MB)')
    try {
      const read = await Promise.all(valid.map(readImageFile))
      setPhotos((prev) => [...prev, ...read])
    } catch {
      setFileError('Could not read one of the selected images')
    }
    e.target.value = ''
  }

  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== i))

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setBgImage(await readImageFile(file))
    } catch {
      setFileError('Could not read that image')
    }
  }

  const toggleShot = (key: string) =>
    setSelectedShots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const totalImages = photos.length * selectedShots.length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (photos.length === 0 || selectedShots.length === 0) return

    const presetDesc = bgPreset === 'custom' ? customBgText.trim() : BACKGROUND_PRESETS.find((p) => p.key === bgPreset)?.description ?? ''
    const shots = SHOT_PRESETS.filter((s) => selectedShots.includes(s.key)).map((s) => s.instruction)

    onGenerate({
      photos: photos.map((p) => ({ data: p.data, mimeType: p.mimeType })),
      shots,
      background:
        bgImage || presetDesc
          ? { preset: bgPreset, description: presetDesc, image: bgImage ? { data: bgImage.data, mimeType: bgImage.mimeType } : null }
          : null,
      aspectRatio,
      quality,
    })
  }

  const inputClass =
    'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Re-shoot Existing Photos</h2>
        <p className="text-gray-500 text-sm mt-1">
          Same product, same design — only lighting, framing and environment change. Materials, colors and finishes stay exactly as in the photo.
        </p>
      </div>

      {/* ---- Photos ---- */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Existing Photos</h3>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={isWorking}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs disabled:opacity-50"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-dashed border-gray-600 rounded-lg px-4 py-3 text-gray-400 cursor-pointer hover:border-blue-500 hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">{photos.length > 0 ? 'Add more photos' : 'Upload one or more product photos'}</span>
          <input type="file" accept="image/*" multiple onChange={handlePhotosUpload} disabled={isWorking} className="hidden" />
        </label>
      </section>

      {/* ---- Shots ---- */}
      <section className="space-y-3 border-t border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-200">Shots to Generate <span className="text-gray-500 font-normal">(per photo)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHOT_PRESETS.map((s) => (
            <label key={s.key} className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer bg-gray-750 border border-gray-700 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={selectedShots.includes(s.key)}
                onChange={() => toggleShot(s.key)}
                disabled={isWorking}
                className="accent-blue-500 mt-0.5"
              />
              <span>
                <span className="block font-medium text-white">{s.label}</span>
                <span className="block text-xs text-gray-500">{s.instruction}</span>
              </span>
            </label>
          ))}
        </div>
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
                Keep original setting
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
              <button
                type="button"
                onClick={() => setBgPreset('custom')}
                disabled={isWorking}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${bgPreset === 'custom' ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'}`}
              >
                ✏️ Custom (describe it)
              </button>
            </div>
            {bgPreset === 'custom' && (
              <textarea
                value={customBgText}
                onChange={(e) => setCustomBgText(e.target.value)}
                placeholder="e.g. a sunlit marble kitchen island with fresh herbs and a linen towel in the background, shallow depth of field"
                rows={2}
                disabled={isWorking}
                className={`${inputClass} resize-none`}
              />
            )}
            <label className="flex items-center justify-center gap-2 w-full bg-gray-700 border border-dashed border-gray-600 rounded-lg px-4 py-2.5 text-gray-400 cursor-pointer hover:border-blue-500 hover:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">…or upload a custom background</span>
              <input type="file" accept="image/*" onChange={handleBgUpload} disabled={isWorking} className="hidden" />
            </label>
          </>
        )}
      </section>

      {/* ---- Aspect ratio & quality ---- */}
      <section className="space-y-4 border-t border-gray-700 pt-6">
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
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Quality / cost per image</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUALITY_TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setQuality(t.value)}
                disabled={isWorking}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${quality === t.value ? 'border-blue-500 bg-blue-600/20' : 'border-gray-600 bg-gray-700 hover:border-gray-500'}`}
              >
                <span className="block text-sm font-medium text-white">{t.label}</span>
                <span className="block text-xs text-gray-400">~€{(t.usdPerImage * 0.92).toFixed(3)}/img</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gray-750 border border-gray-700 rounded-lg px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-gray-300">{photos.length} photo{photos.length === 1 ? '' : 's'} × {selectedShots.length} shot{selectedShots.length === 1 ? '' : 's'} = {totalImages} images</span>
          <span className="text-sm font-semibold text-green-400">≈ €{estimateEur(totalImages, quality)}</span>
        </div>
      </section>

      {fileError && <p className="text-red-400 text-xs">{fileError}</p>}

      <button
        type="submit"
        disabled={isWorking || photos.length === 0 || selectedShots.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {isWorking ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Working...
          </>
        ) : (
          `Re-shoot ${totalImages || ''} Photo${totalImages === 1 ? '' : 's'} →`
        )}
      </button>
    </form>
  )
}
