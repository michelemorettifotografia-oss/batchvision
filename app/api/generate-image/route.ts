import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { ALLOWED_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, aspectInstruction, manufacturingInstruction, materialsToText, type AspectRatio, type MaterialSpec, type ImageRef, type AdaptOptions, type ManufacturingConfig, type ReferenceMode } from '@/app/types'

interface RequestBody {
  prompt?: string
  model?: string
  materials?: MaterialSpec | null
  aspectRatio?: AspectRatio | null
  manufacturing?: ManufacturingConfig | null
  reference?: { image: ImageRef | null; mode: ReferenceMode; adapt: AdaptOptions } | null
  background?: { description: string; image: ImageRef | null } | null
}

// Always-on realism guardrails to reduce hallucinated / impossible details
// that create unusable rejects. Text tokens are negligible, so this does not
// add cost or generation time.
const REALISM_GUARDRAILS =
  'Render a real, existing, physically plausible product with photorealistic, coherent and functional details. ' +
  'Do NOT invent impossible mechanisms, floating or disconnected parts, duplicated or extra controls/buttons, ' +
  'nonsensical components, warped or fake text and logos, extra nozzles/handles/ports, or surreal elements. ' +
  'Keep the number of parts, ports and controls realistic, symmetric where expected, and manufacturable. ' +
  'If unsure about a detail, prefer a simple, clean, believable solution over an invented one.'

function adaptToText(adapt: AdaptOptions): string {
  const allowed: string[] = []
  if (adapt.moveNozzles) allowed.push('reposition the nozzles/spouts')
  if (adapt.changeButtons) allowed.push('redesign the buttons and controls')
  if (adapt.modifyLights) allowed.push('change the lighting elements, screens and indicators')
  if (adapt.generateProposals) allowed.push('propose a bolder variation that noticeably transforms the product while keeping its core function recognizable')
  let t = ''
  if (allowed.length) t += ` You MAY modify the product in these ways: ${allowed.join('; ')}.`
  if (adapt.notes?.trim()) t += ` Additional design direction: ${adapt.notes.trim()}.`
  return t
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { prompt, materials, aspectRatio, manufacturing, reference, background } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const modelName = body.model && ALLOWED_IMAGE_MODELS.includes(body.model) ? body.model : DEFAULT_IMAGE_MODEL
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName })

    const parts: Part[] = []
    let instruction = ''

    const hasReference = !!reference?.image?.data
    const hasBgImage = !!background?.image?.data

    if (hasReference && reference?.image) {
      parts.push({ inlineData: { data: reference.image.data, mimeType: reference.image.mimeType } })
      if (reference.mode === 'exact') {
        instruction +=
          'The first attached image is the actual product. Reproduce THIS EXACT product — identical geometry, proportions, parts, controls and layout. Do not change its structure or invent new parts; only apply the restyling, materials and scene described below. '
      } else {
        instruction +=
          'The first attached image is the actual product. Keep its overall proportions, dimensions and general layout as the base.' +
          adaptToText(reference.adapt) +
          ' Otherwise keep the product recognizable. '
      }
    }

    if (hasBgImage && background?.image) {
      parts.push({ inlineData: { data: background.image.data, mimeType: background.image.mimeType } })
      instruction += `The ${hasReference ? 'second' : 'first'} attached image is the desired background/scene. Place the product naturally into this background with correct perspective, scale, contact shadows and reflections. `
    }

    instruction += prompt

    const mt = materialsToText(materials)
    if (mt) instruction += `\n${mt}`

    if (!hasBgImage && background?.description?.trim()) {
      instruction += `\nBackground / scene: ${background.description.trim()}.`
    }

    const mfg = manufacturingInstruction(manufacturing)
    if (mfg) instruction += `\n${mfg}`

    if (aspectRatio) {
      instruction += `\n${aspectInstruction(aspectRatio)}`
    }

    instruction += `\n${REALISM_GUARDRAILS}`

    parts.push({ text: instruction })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        // Slightly below the default to curb wild hallucinations while keeping
        // enough variety for distinct styles and variants.
        temperature: 0.6,
        // @ts-expect-error responseModalities is valid for image generation
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    const responseParts = result.response.candidates?.[0]?.content?.parts
    if (!responseParts) {
      return NextResponse.json({ error: 'No response parts from Gemini' }, { status: 500 })
    }

    const imagePart = responseParts.find(
      (p: { inlineData?: { data: string; mimeType: string }; text?: string }) => p.inlineData
    )
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
