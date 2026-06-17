'use client'

import { ImageSlot } from '@/app/page'

interface ImageCardProps {
  prompt: string
  image: ImageSlot
  index: number
}

export default function ImageCard({ prompt, image, index }: ImageCardProps) {
  const isLoaded = image !== null && 'imageBase64' in image
  const isFailed = image !== null && 'error' in image

  return (
    <div className="relative group aspect-square bg-gray-700 rounded-lg overflow-hidden">
      {isLoaded ? (
        <>
          <img
            src={`data:${image.mimeType};base64,${image.imageBase64}`}
            alt={`Generated image ${index + 1}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex items-end">
            <p className="text-white text-xs leading-relaxed line-clamp-6">{prompt}</p>
          </div>
        </>
      ) : isFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400 text-xs text-center line-clamp-3">{image.error}</p>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <div className="animate-pulse w-8 h-8 bg-gray-600 rounded-full" />
          <p className="text-gray-500 text-xs text-center px-2 line-clamp-3">{prompt.substring(0, 60)}...</p>
        </div>
      )}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
        {index + 1}
      </div>
    </div>
  )
}
