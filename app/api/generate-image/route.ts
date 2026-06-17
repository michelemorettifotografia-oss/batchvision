import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'

interface ReferenceImage {
  data: string
  mimeType: string
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceImage } = await req.json() as {
      prompt?: string
      referenceImage?: ReferenceImage | null
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-image',
    })

    const parts: Part[] = []
    if (referenceImage?.data) {
      parts.push({ inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } })
      parts.push({
        text: `Use the attached photo as the product identity reference. Keep the SAME product type, overall form and proportions as in the reference. Do not add unrelated objects. Restyle it as follows: ${prompt}`,
      })
    } else {
      parts.push({ text: prompt })
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        // @ts-expect-error responseModalities is valid for image generation
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    const responseParts = result.response.candidates?.[0]?.content?.parts
    if (!responseParts) {
      return NextResponse.json({ error: 'No response parts from Gemini' }, { status: 500 })
    }

    const imagePart = responseParts.find((p: { inlineData?: { data: string; mimeType: string }; text?: string }) => p.inlineData)
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
