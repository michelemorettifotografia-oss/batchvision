import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, type AspectRatio, type UpscaleSize } from '@/app/types'

// Strict fidelity instruction: this is an upscale, not a re-imagining.
const UPSCALE_INSTRUCTION =
  'Upscale this exact image to a higher resolution. Reproduce it faithfully: identical composition, framing, camera angle, ' +
  'geometry, proportions, colors, materials, lighting, shadows, reflections and background. ' +
  'Do NOT add, remove, move, restyle or redesign anything. Do not change the crop or aspect ratio. Do not add text or logos. ' +
  'Only increase resolution and micro-detail fidelity: sharper edges, cleaner surface textures and material grain, reduced ' +
  'compression artifacts and noise. The result must be indistinguishable from the input except for being higher resolution and sharper.'

interface RequestBody {
  imageBase64?: string
  mimeType?: string
  size?: UpscaleSize
  model?: string
  aspectRatio?: AspectRatio | null
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, size, model, aspectRatio } = (await req.json()) as RequestBody

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const modelName = model && ALLOWED_IMAGE_MODELS.includes(model) ? model : DEFAULT_IMAGE_MODEL
    const imageSize: UpscaleSize = size === '4K' ? '4K' : '2K'

    // Called over REST rather than through @google/generative-ai: the legacy
    // SDK does not forward generationConfig.imageConfig, so imageSize would be
    // silently dropped and the output would stay at 1K.
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
            { text: UPSCALE_INSTRUCTION },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0,
        imageConfig: {
          imageSize,
          ...(aspectRatio ? { aspectRatio } : {}),
        },
      },
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text.slice(0, 400) }, { status: res.status })
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData)

    if (!imagePart?.inlineData) {
      return NextResponse.json({ error: 'No image returned by the upscaler' }, { status: 500 })
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      size: imageSize,
    })
  } catch (err) {
    console.error('upscale-image error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
