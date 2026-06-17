'use client'

import { useState } from 'react'

interface ImageItem {
  imageBase64: string
  mimeType: string
  filename: string
}

interface DownloadButtonProps {
  images: ImageItem[]
}

export default function DownloadButton({ images }: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      images.forEach(({ imageBase64, mimeType, filename }) => {
        const ext = mimeType.split('/')[1] || 'png'
        zip.file(`${filename}.${ext}`, imageBase64, { base64: true })
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'batchvision-images.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading || images.length === 0}
      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center gap-2"
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
          Download All {images.length} Images (ZIP)
        </>
      )}
    </button>
  )
}
