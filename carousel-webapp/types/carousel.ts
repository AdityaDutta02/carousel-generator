export type CarouselStatus = 'draft' | 'exported'

export type SlotValue = Record<string, string>

export interface Slide {
  index: number
  slots: SlotValue
}

export type Platform = 'linkedin' | 'instagram' | 'stories' | 'tiktok'

export interface Carousel {
  id: string
  owner: string
  title: string
  templateId: string
  platform: Platform
  canvasWidth: number
  canvasHeight: number
  slideCount: number
  slides: Slide[]
  status: CarouselStatus
  created: string
  updated: string
}

export interface GeneratedCopy {
  hook: string
  slides: Array<{
    headline: string
    body: string
    stat?: string
    quote?: string
  }>
  cta: string
}

export const CANVAS_SIZES: Record<string, { width: number; height: number; label: string }> = {
  'instagram-square': { width: 1080, height: 1080, label: 'Instagram Square / LinkedIn (1080×1080)' },
  'instagram-portrait': { width: 1080, height: 1350, label: 'Instagram Portrait (1080×1350)' },
  'stories': { width: 1080, height: 1920, label: 'Stories / TikTok (1080×1920)' },
  'linkedin-native': { width: 1080, height: 1300, label: 'LinkedIn Native (1080×1300)' },
  'linkedin-link': { width: 1200, height: 628, label: 'LinkedIn Link Preview (1200×628)' },
}
