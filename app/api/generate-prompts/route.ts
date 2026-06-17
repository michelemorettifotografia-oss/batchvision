import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import type { ImageRef, AdaptOptions, ReferenceMode } from '@/app/types'

function buildSystemPrompt(styleCount: number, promptsPerStyle: number): string {
  const total = styleCount * promptsPerStyle
  return `You are an expert AI Prompt Engineer and world-class Product Design assistant.
Generate exactly ${styleCount} distinct design styles for the given machine, then ${promptsPerStyle} unique image generation prompts per style (${total} total).

CRITICAL RULES — staying on subject:
- EVERY prompt must depict the SAME machine/product specified by the user. The product is always the clear hero of the shot.
- Never drift to unrelated objects, people, animals, abstract scenes, logos, text overlays or props that distract from the product.
- Keep the product's core function, form factor and proportions recognizable across all prompts. Only the style, materials, finish, setting, angle and lighting change.
- If the user provides an "Avoid" / constraints list, never include those elements.
- If a reference product photo is attached, treat it as the ground truth for the product's shape, proportions and identity. Extract its real materials and color cues; do not invent a different product.
- If the user specifies a background/scene, place the product in that environment consistently across the prompts.

Each prompt must be in English and include:
- The machine subject integrating the chosen style (named explicitly so the image model cannot drift)
- Materials, colors, textures, finishes (e.g. brushed aluminum, matte terracotta ceramic, carbon fiber)
- The user's setting and orientation, adapted photorealistically
- Lighting and photographic style (studio lighting, cinematic shot, soft shadows, 8k resolution, product photography)
- Slight variations across the ${promptsPerStyle} prompts (angles, light, macro details, day/night mood)

For each style also return a structured "materials" object with these fields (short phrases, no sentences):
- primary: the dominant material/body finish
- accent: a secondary/accent material
- finish: surface finish (e.g. matte, brushed, glossy, soft-touch)
- palette: the color palette in a few words

Return ONLY valid JSON in this exact format:
{
  "styles": [
    {
      "name": "Style Name",
      "description": "Brief mood description and why chosen for this machine",
      "materials": { "primary": "...", "accent": "...", "finish": "...", "palette": "..." },
      "prompts": [${Array.from({ length: promptsPerStyle }, (_, i) => `"prompt${i + 1}"`).join(', ')}]
    }
  ]
}`
}

interface RequestBody {
  machine?: string
  brief?: string
  setting?: string
  constraints?: string
  styleCount?: number
  promptsPerStyle?: number
  reference?: { image: ImageRef | null; mode: ReferenceMode; adapt: AdaptOptions } | null
  background?: { description: string; image: ImageRef | null } | null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { machine, brief, setting, constraints, reference, background } = body
    const styleCount = Math.min(Math.max(body.styleCount ?? 5, 1), 8)
    const promptsPerStyle = Math.min(Math.max(body.promptsPerStyle ?? 8, 1), 12)

    if (!machine || !brief || !setting) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemPrompt(styleCount, promptsPerStyle),
    })

    let userPrompt = `Machine: ${machine}\nBrief/Focus: ${brief}\nSetting & Orientation: ${setting}`
    if (constraints && constraints.trim()) {
      userPrompt += `\nAvoid / must NOT appear: ${constraints.trim()}`
    }
    if (background?.description?.trim()) {
      userPrompt += `\nBackground / scene for every shot: ${background.description.trim()}`
    }
    if (reference?.image?.data) {
      if (reference.mode === 'exact') {
        userPrompt += `\nA reference product photo is attached. Reproduce this EXACT product — keep its geometry and parts identical, only restyle materials/finish/scene.`
      } else {
        const mods: string[] = []
        if (reference.adapt.moveNozzles) mods.push('the nozzles/spouts may be repositioned')
        if (reference.adapt.changeButtons) mods.push('the buttons/controls may be redesigned')
        if (reference.adapt.modifyLights) mods.push('the lighting elements/indicators may be changed')
        if (reference.adapt.generateProposals) mods.push('bolder design variations that transform the product are encouraged')
        userPrompt += `\nA reference product photo is attached. Keep its overall proportions and dimensions, but you may adapt the design: ${mods.length ? mods.join('; ') : 'minor refinements only'}.`
        if (reference.adapt.notes?.trim()) userPrompt += ` Extra direction: ${reference.adapt.notes.trim()}.`
      }
    }

    const parts: Part[] = []
    if (reference?.image?.data) {
      parts.push({ inlineData: { data: reference.image.data, mimeType: reference.image.mimeType } })
    }
    parts.push({ text: userPrompt })

    const result = await model.generateContent(parts)
    const text = result.response.text()

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text

    let parsed
    try {
      parsed = JSON.parse(jsonStr.trim())
    } catch {
      return NextResponse.json({ error: 'Failed to parse Gemini response as JSON', raw: text }, { status: 500 })
    }

    if (!parsed.styles || !Array.isArray(parsed.styles)) {
      return NextResponse.json({ error: 'Invalid response structure from Gemini' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('generate-prompts error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
