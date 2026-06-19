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
  // When set (e.g. advertising sets), use this image as an exact product
  // reference for all generations in this block instead of the global brief.
  referenceOverride?: ImageRef | null
  isAdv?: boolean
}

export const ADV_SHOTS: string[] = [
  'Hero three-quarter front view on a seamless gradient studio backdrop, soft key light with gentle reflections, premium advertising product photography',
  'Dramatic low-angle shot with cinematic moody lighting and deep shadows on a dark reflective surface',
  'Lifestyle wide shot placed in a bright modern interior with natural daylight and shallow depth of field',
  'Extreme close-up macro detail of a key feature, crisp studio lighting highlighting materials and finish',
  'Top-down flat-lay composition on a textured surface with minimal styling props, bright even lighting',
]

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

export interface ManufacturingConfig {
  processes: string[]            // available / preferred production processes
  avoidExpensiveTooling: boolean // avoid injection molds, complex multi-axis machining, etc.
  notes: string
}

// Image model quality/cost tiers. usdPerImage is the approximate cost for a
// standard 1024px image (synchronous API). Source: Google Gemini API pricing.
export type QualityTier = 'economy' | 'standard' | 'pro'

export const QUALITY_TIERS: { value: QualityTier; label: string; model: string; usdPerImage: number; note: string }[] = [
  { value: 'economy', label: 'Economy', model: 'gemini-2.5-flash-image', usdPerImage: 0.039, note: 'Nano Banana · best value' },
  { value: 'standard', label: 'Standard', model: 'gemini-3.1-flash-image', usdPerImage: 0.06, note: 'Nano Banana 2 · sharper' },
  { value: 'pro', label: 'Pro', model: 'gemini-3-pro-image', usdPerImage: 0.134, note: 'Nano Banana Pro · top quality' },
]

export const ALLOWED_IMAGE_MODELS = QUALITY_TIERS.map((t) => t.model)
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'

export const USD_TO_EUR = 0.92

export function tierFor(q?: QualityTier | null) {
  return QUALITY_TIERS.find((t) => t.value === q) ?? QUALITY_TIERS[0]
}

export function modelForQuality(q?: QualityTier | null): string {
  return tierFor(q).model
}

// Estimated EUR cost string for a number of images at a given tier.
export function estimateEur(images: number, q?: QualityTier | null): string {
  return (images * tierFor(q).usdPerImage * USD_TO_EUR).toFixed(2)
}

export interface BriefData {
  machine: string
  brief: string
  setting: string
  constraints: string
  styleCount: number
  promptsPerStyle: number
  aspectRatio: AspectRatio
  quality: QualityTier
  designStyles: string[]
  manufacturing: ManufacturingConfig
  reference: ReferenceConfig
  background: BackgroundConfig
}

export const DEFAULT_MANUFACTURING: ManufacturingConfig = {
  processes: [],
  avoidExpensiveTooling: false,
  notes: '',
}

// Curated, recognizable product / industrial design styles to pick from.
export const DESIGN_STYLE_PRESETS: string[] = [
  'Minimalist Nordic',
  'Japandi',
  'Bauhaus',
  'Mid-Century Modern',
  'Industrial Utilitarian',
  'High-Tech',
  'Brutalist',
  'Streamline Moderne',
  'Art Deco',
  'Memphis',
  'Organic / Biomorphic',
  'Monolithic Monochrome',
  'Retro-Futurism',
  'Soft Minimalism',
  'Premium Luxury',
  'Eco / Sustainable',
]

// Common material-working technologies, used to keep designs producible.
export const MANUFACTURING_PROCESSES: string[] = [
  'CNC machining',
  'Sheet metal bending',
  'Aluminum extrusion',
  'Tube bending',
  'Die casting',
  'Injection molding',
  '3D printing',
  'Vacuum / thermoforming',
  'Laser cutting',
  'Woodworking / CNC routing',
  'Powder coating',
  'Anodizing',
]

// Build a manufacturing-awareness instruction shared by prompt and image generation.
export function manufacturingInstruction(m?: ManufacturingConfig | null): string {
  if (!m) return ''
  const segments: string[] = []
  if (m.processes.length) {
    segments.push(`The product must be manufacturable primarily with: ${m.processes.join(', ')}. Favor geometries, parting lines and materials suited to these processes (e.g. bent sheet metal, extruded profiles, off-the-shelf fasteners, simple turned/milled parts).`)
  }
  if (m.avoidExpensiveTooling) {
    segments.push('Avoid designs that require expensive tooling such as large custom injection molds, complex multi-axis machining, or intricate seamless organic shells. Prefer low-tooling-cost, small-batch friendly construction.')
  }
  if (m.notes?.trim()) {
    segments.push(`Manufacturing notes: ${m.notes.trim()}.`)
  }
  return segments.join(' ')
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
