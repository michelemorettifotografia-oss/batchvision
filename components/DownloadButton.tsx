'use client'

import { useState } from 'react'
import { StyleData } from '@/app/page'

interface DownloadButtonProps {
  styles: StyleData[]
}

function buildPromptsText(styles: StyleData[]): string {
  const lines: string[] = ['BATCHVISION — Generated Prompts', '='.repeat(48), '']
  styles.forEach((style, si) => {
    lines.push(`STYLE ${si + 1}: ${style.name}`)
    lines.push(style.description)
    lines.push('')
    style.prompts.forEach((p, pi) => {
      lines.push(`  ${pi + 1}. ${p}`)
    })
    lines.push('')
    lines.push('-'.repeat(48))
    lines.push('')
  })
  return lines.join('\n')
}

export default function DownloadButton({ styles }: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const successfulImages = styles.flatMap((style, si) =>
    style.images
      .map((img, pi) =>
        img && 'imageBase64' in img
          ? {
              imageBase64: img.imageBase64,
              mimeType: img.mimeType,
              folder: `style${si + 1}_${style.name.replace(/\s+/g, '_')}`,
              filename: `image_${pi + 1}`,
            }
          : null
      )
      .filter((x): x is NonNullable<typeof x> => x !== null)
  )

  const handleDownloadZip = async () => {
    setIsDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      zip.file('prompts.txt', buildPromptsText(styles))

      successfulImages.forEach(({ imageBase64, mimeType, folder, filename }) => {
        const ext = mimeType.split('/')[1] || 'png'
        zip.folder(folder)!.file(`${filename}.${ext}`, imageBase64, { base64: true })
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'batchvision-export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('ZIP download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSavePrompts = () => {
    const text = buildPromptsText(styles)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batchvision-prompts.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={handleDownloadZip}
        disabled={isDownloading || successfulImages.length === 0}
        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
      >
        {isDownloading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Preparing ZIP...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {successfulImages.length} Images (ZIP)
          </>
        )}
      </button>

      <button
        onClick={handleSavePrompts}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Save Prompts (TXT)
      </button>
    </div>
  )
}
