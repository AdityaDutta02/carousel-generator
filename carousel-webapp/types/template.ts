// carousel-webapp/types/template.ts

export interface TemplateColor {
  primary: string
  dark: string
  accent: string
  white: string
}

export interface TypographyEntry {
  family: string
  weights: number[]
  googleFonts: string
}

export interface Typography {
  display: TypographyEntry
  body: TypographyEntry
  serif: TypographyEntry
}

export interface TypescaleEntry {
  size: number
  weight: number
  lineHeight?: number
  letterSpacing?: string
  transform?: string
  style?: string
  font?: string
  opacity?: number
}

export interface SlideLayoutSlots {
  [key: string]: string
}

export interface SlideLayout {
  background: string
  foreground: string
  structure: string
  slots: SlideLayoutSlots
  use: string
}

export interface SlideSequenceRules {
  first: string
  last: string
  variation: string
  recommended: Record<string, string[]>
}

export interface ExportSettings {
  deviceScaleFactor: number
  outputSize: string
  logicalSize: string
  format: string
  exportScript: string
}

export interface TemplateJson {
  colors: TemplateColor
  typography: Typography
  typescale: Record<string, TypescaleEntry>
  spacing: {
    slidePadding: number
    cardPadding: number
    sectionGap: number
    cardRadius: number
    tagRadius: string
  }
  components: Record<string, unknown>
  slideLayouts: Record<string, SlideLayout>
  slideSequenceRules: SlideSequenceRules
  exportSettings: ExportSettings
  generationRules: Record<string, unknown>
}
