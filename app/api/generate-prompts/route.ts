import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `You are an expert AI Prompt Engineer and world-class Product Design assistant.
Generate exactly 5 distinct design styles for the given machine, then 8 unique image generation prompts per style (40 total).

Each prompt must be in English and include:
- The machine subject integrating the chosen style
- Materials, colors, textures, finishes (e.g. brushed aluminum, matte terracotta ceramic, carbon fiber)
- The user's setting and orientation, adapted photorealistically
- Lighting and photographic style (studio lighting, cinematic shot, soft shadows, 8k resolution, product photography)
- Slight variations across the 8 prompts (angles, light, macro details, day/night mood)

Return ONLY valid JSON in this exact format:
{
  "styles": [
    {
      "name": "Style Name",
      "description": "Brief mood description and why chosen for this machine",
      "prompts": ["prompt1", "prompt2", "prompt3", "prompt4", "prompt5", "prompt6", "prompt7", "prompt8"]
    }
  ]
}`

export async function POST(req: NextRequest) {
  try {
    const { machine, brief, setting } = await req.json()

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
      systemInstruction: SYSTEM_PROMPT,
    })

    const userPrompt = `Machine: ${machine}\nBrief/Focus: ${brief}\nSetting & Orientation: ${setting}`

    const result = await model.generateContent(userPrompt)
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
