export type SlotType = 'text' | 'css_var' | 'font_size' | 'toggle'

export interface SlotDefinition {
  id: string
  slide: number | 'all'
  selector: string
  type: SlotType
  label: string
  maxChars?: number        // text only
  variable?: string        // css_var only: e.g. '--accent'
  min?: number             // font_size only
  max?: number             // font_size only
  default?: string         // css_var and font_size
}

export interface SchemaJson {
  version: 1
  slots: SlotDefinition[]
}

export interface Template {
  id: string
  name: string
  scope: 'system' | 'user'
  owner: string | null
  htmlFileUrl: string
  schemaJson: SchemaJson
  thumbnailUrl: string
  canvasWidth: number
  canvasHeight: number
  platformTags: string[]
  slideCountDefault: number
}
