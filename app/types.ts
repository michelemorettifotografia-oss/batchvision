// Shared types and helpers for BatchVision.
// No 'use client' here so both server routes and client components can import it.

export interface ImageRef {
  data: string
  mimeType: string
}

export type ImageSlot =
  | { imageBase64: string; mimeType: string; size?: string }
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
  // When set (e.g. advertising sets, re-shoots), use this image as an exact
  // product reference for all generations in this block instead of the
  // global brief.
  referenceOverride?: ImageRef | null
  isAdv?: boolean
  // Per-block overrides used by standalone flows (ADV, Re-shoot) that build
  // their own generation config instead of relying on the main BriefData.
  backgroundOverride?: BackgroundConfig | null
  aspectRatioOverride?: AspectRatio | null
  modelOverride?: string
  // When true, the image API must not restyle the product at all: same
  // materials, colors, finish and geometry — only lighting, framing,
  // environment and photographic quality may change. Used by Re-shoot.
  lockDesign?: boolean
}

// Framing & lighting treatments shared by ADV sets and photo re-shoots.
export const SHOT_PRESETS: { key: string; label: string; instruction: string }[] = [
  { key: 'hero', label: 'Studio Hero', instruction: 'Hero three-quarter front view on a seamless gradient studio backdrop, soft key light with gentle reflections, premium advertising product photography' },
  { key: 'dramatic', label: 'Dramatic Mood', instruction: 'Dramatic low-angle shot with cinematic moody lighting and deep shadows on a dark reflective surface' },
  { key: 'lifestyle', label: 'Lifestyle Bright', instruction: 'Lifestyle wide shot placed in a bright modern interior with natural daylight and shallow depth of field' },
  { key: 'macro', label: 'Macro Detail', instruction: 'Extreme close-up macro detail of a key feature, crisp studio lighting highlighting real existing materials and finish' },
  { key: 'topdown', label: 'Top-Down Flat', instruction: 'Top-down flat-lay composition on a textured surface with minimal styling props, bright even lighting' },
]

export const ADV_SHOTS: string[] = SHOT_PRESETS.map((s) => s.instruction)

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
export type QualityTier = 'budget' | 'economy' | 'standard' | 'pro'

// usd2K / usd4K are the cost of one image rendered at that resolution, used
// for upscale estimates (economy & pro figures from Google pricing; standard
// is interpolated; budget's 2K/4K are estimated from the sibling Flash model
// since Google has not published Lite-specific higher-resolution rates yet).
export const QUALITY_TIERS: { value: QualityTier; label: string; model: string; usdPerImage: number; usd2K: number; usd4K: number; note: string }[] = [
  { value: 'budget', label: 'Budget', model: 'gemini-3.1-flash-lite-image', usdPerImage: 0.034, usd2K: 0.101, usd4K: 0.151, note: 'Nano Banana 2 Lite · cheapest' },
  { value: 'economy', label: 'Economy', model: 'gemini-2.5-flash-image', usdPerImage: 0.039, usd2K: 0.101, usd4K: 0.151, note: 'Nano Banana · best value' },
  { value: 'standard', label: 'Standard', model: 'gemini-3.1-flash-image', usdPerImage: 0.06, usd2K: 0.12, usd4K: 0.19, note: 'Nano Banana 2 · sharper' },
  { value: 'pro', label: 'Pro', model: 'gemini-3-pro-image', usdPerImage: 0.134, usd2K: 0.134, usd4K: 0.24, note: 'Nano Banana Pro · top quality' },
]

// Upscale target resolutions. 1K is the default generation size, so upscaling
// only offers the larger tiers.
export type UpscaleSize = '2K' | '4K'

export const UPSCALE_SIZES: { value: UpscaleSize; label: string; note: string }[] = [
  { value: '2K', label: '2K', note: '2048px · recommended' },
  { value: '4K', label: '4K', note: '4096px · print' },
]

export function estimateUpscaleEur(images: number, q?: QualityTier | null, size: UpscaleSize = '2K'): string {
  const tier = tierFor(q)
  const usd = size === '4K' ? tier.usd4K : tier.usd2K
  return (images * usd * USD_TO_EUR).toFixed(2)
}

export const ALLOWED_IMAGE_MODELS = QUALITY_TIERS.map((t) => t.model)
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-lite-image'

export const USD_TO_EUR = 0.92

export function tierFor(q?: QualityTier | null) {
  return QUALITY_TIERS.find((t) => t.value === q) ?? QUALITY_TIERS[0]
}

export function modelForQuality(q?: QualityTier | null): string {
  return tierFor(q).model
}

// Reverse lookup: used to price work that was queued with an explicit model
// (e.g. Re-shoot blocks carry their own modelOverride).
export function tierByModel(model?: string | null) {
  return QUALITY_TIERS.find((t) => t.model === model) ?? QUALITY_TIERS[0]
}

// Estimated EUR cost string for a number of images at a given tier.
export function estimateEur(images: number, q?: QualityTier | null): string {
  return (images * tierFor(q).usdPerImage * USD_TO_EUR).toFixed(2)
}

// Config for the "Re-shoot" flow: take existing product photos and only
// change lighting, framing and environment/background — never the design.
export interface ReshootData {
  photos: ImageRef[]
  shots: string[]                    // chosen shot instruction strings (from SHOT_PRESETS)
  background: BackgroundConfig | null
  aspectRatio: AspectRatio
  quality: QualityTier
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
