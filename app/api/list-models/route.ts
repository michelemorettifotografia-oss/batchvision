import { NextResponse } from 'next/server'

interface GeminiModel {
  name: string
  displayName: string
  description: string
  supportedGenerationMethods: string[]
  outputTokenLimit?: number
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const data = await res.json() as { models: GeminiModel[] }
    const models = data.models ?? []

    const imageCapable = models.filter((m) =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      (m.name.includes('image') || m.displayName?.toLowerCase().includes('image'))
    )

    const generateContent = models.filter((m) =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      !imageCapable.includes(m)
    )

    return NextResponse.json({
      image_generation_models: imageCapable.map((m) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
        methods: m.supportedGenerationMethods,
      })),
      other_generate_content_models: generateContent.map((m) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
      })),
      total: models.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
