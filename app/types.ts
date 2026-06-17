// Shared types and helpers for BatchVision.
// No 'use client' here so both server routes and client components can import it.

export interface ImageRef {
  data: string
  mimeType: string
}

export type ImageSlot =
  | { imageBase64: string; mimeType: string }
  | { error: string }
  | null

export interface MaterialSpec {
  primary: string
  accent: string
  finish: string
  palette: string
}

export interface StyleData {
  name: string
  description: string
  materials: MaterialSpec
  prompts: string[]
  images: ImageSlot[]
}

export type ReferenceMode = 'exact' | 'adapt'

export interface AdaptOptions {
  moveNozzles: boolean
  changeButtons: boolean
  modifyLights: boolean
  generateProposals: boolean
  notes: string
}

export interface ReferenceConfig {
  image: ImageRef | null
  mode: ReferenceMode
  adapt: AdaptOptions
}

export interface BackgroundConfig {
  preset: string            // preset key, or '' for none
  description: string       // resolved text description sent to the model
  image: ImageRef | null    // custom background image
}

export type AspectRatio = '1:1' | '4:3' | '16:9'

export const ASPECT_RATIOS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: '1:1', label: 'Square 1:1', hint: 'catalog / social' },
  { value: '4:3', label: 'Standard 4:3', hint: 'classic product' },
  { value: '16:9', label: 'Wide 16:9', hint: 'hero / web banner' },
]

// Literal class strings so Tailwind's JIT scanner picks them up.
export function aspectClass(r: AspectRatio): string {
  if (r === '4:3') return 'aspect-[4/3]'
  if (r === '16:9') return 'aspect-[16/9]'
  return 'aspect-square'
}

export function aspectInstruction(r: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    '1:1': 'a square 1:1',
    '4:3': 'a 4:3',
    '16:9': 'a wide 16:9 cinematic',
  }
  return `Compose the shot as ${map[r]} aspect ratio image, framed for that ratio.`
}

export interface BriefData {
  machine: string
  brief: string
  setting: string
  constraints: string
  styleCount: number
  promptsPerStyle: number
  aspectRatio: AspectRatio
  reference: ReferenceConfig
  background: BackgroundConfig
}

export const EMPTY_MATERIALS: MaterialSpec = { primary: '', accent: '', finish: '', palette: '' }

export const DEFAULT_ADAPT: AdaptOptions = {
  moveNozzles: false,
  changeButtons: false,
  modifyLights: false,
  generateProposals: false,
  notes: '',
}

export const BACKGROUND_PRESETS: { key: string; label: string; description: string }[] = [
  { key: 'studio-white', label: 'Studio White', description: 'seamless pure white studio backdrop with soft, even lighting' },
  { key: 'studio-gradient', label: 'Studio Gradient', description: 'smooth grey-to-white gradient studio background, professional product photography' },
  { key: 'concrete', label: 'Concrete Loft', description: 'minimalist polished concrete surface in an industrial loft with soft directional light' },
  { key: 'kitchen', label: 'Modern Kitchen', description: 'high-end modern kitchen countertop with natural daylight and subtle bokeh' },
  { key: 'office', label: 'Design Office', description: 'clean contemporary design office desk with soft ambient light' },
  { key: 'wood', label: 'Warm Wood', description: 'warm oak wooden table with cozy natural light and gentle shadows' },
  { key: 'terrace', label: 'Outdoor Terrace', description: 'modern outdoor terrace at golden hour with warm natural daylight' },
  { key: 'dark', label: 'Dark Moody', description: 'dark moody background with dramatic directional lighting and deep shadows' },
]

// Turn the structured material spec into a compact instruction line.
export function materialsToText(m?: MaterialSpec | null): string {
  if (!m) return ''
  const parts: string[] = []
  if (m.primary?.trim()) parts.push(`primary material ${m.primary.trim()}`)
  if (m.accent?.trim()) parts.push(`accent material ${m.accent.trim()}`)
  if (m.finish?.trim()) parts.push(`finish ${m.finish.trim()}`)
  if (m.palette?.trim()) parts.push(`color palette ${m.palette.trim()}`)
  return parts.length ? `Materials and finish: ${parts.join(', ')}.` : ''
}

// Human-readable one-liner for exports / summaries.
export function materialsToLabel(m?: MaterialSpec | null): string {
  if (!m) return ''
  return [m.primary, m.accent, m.finish, m.palette].map((v) => v?.trim()).filter(Boolean).join(', ')
}

export function isLoaded(slot: ImageSlot): slot is { imageBase64: string; mimeType: string } {
  return slot !== null && 'imageBase64' in slot
}
