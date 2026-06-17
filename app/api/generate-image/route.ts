import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        // @ts-expect-error responseModalities is valid for image generation
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    const parts = result.response.candidates?.[0]?.content?.parts
    if (!parts) {
      return NextResponse.json({ error: 'No response parts from Gemini' }, { status: 500 })
    }

    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string }; text?: string }) => p.inlineData)
    if (!imagePart?.inlineData) {
      return NextResponse.json({ error: 'No image in response' }, { status: 500 })
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    })
  } catch (err) {
    console.error('generate-image error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
