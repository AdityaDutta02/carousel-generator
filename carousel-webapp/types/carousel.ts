// carousel-webapp/types/carousel.ts

export type SlideLayoutType =
  | 'cover' | 'data' | 'card' | 'insight' | 'quote' | 'cta' | 'opinion'

export interface CoverSlide {
  id: string; layout: 'cover'
  topicTag: string; categoryTag: string
  headline: string[]; circledWord: number; tagline: string
}
export interface DataSlide {
  id: string; layout: 'data'
  brand: string; date: string
  stat: string; unit: string; dataLabel: string; caption: string[]
}
export interface CardSlide {
  id: string; layout: 'card'
  topicTag?: string; categoryTag?: string
  eyebrow: string; stmt: string; body: string; ctaLabel?: string
}
export interface InsightSlide {
  id: string; layout: 'insight'
  brand: string; headline: string[]; accentWord?: number; caption: string[]
}
export interface QuoteSlide {
  id: string; layout: 'quote'
  topicTag?: string; eyebrow: string
  headline: string[]; body: string; tagline?: string
}
export interface CtaSlide {
  id: string; layout: 'cta'
  brand?: string; eyebrow: string; stmt: string; body: string; ctaLabel: string
}
export interface OpinionSlide {
  id: string; layout: 'opinion'
  brand: string; eyebrow: string
  headline: string[]; accentWord?: number; quote: string; ctaText: string
}

export type SlideContent =
  | CoverSlide | DataSlide | CardSlide | InsightSlide
  | QuoteSlide | CtaSlide | OpinionSlide

export interface ContentJsonMeta {
  topic: string
  brand: string
  slideCount: number
  platform: 'LinkedIn' | 'Instagram'
}

export interface ContentJson {
  meta: ContentJsonMeta
  slides: SlideContent[]
}

export type FieldType = 'text' | 'textarea' | 'number' | 'array'

export interface FormField {
  key: string
  label: string
  type: FieldType
  value: string | string[] | number
  placeholder?: string
}

export interface FormFieldGroup {
  slideId: string
  layout: SlideLayoutType
  fields: FormField[]
}
