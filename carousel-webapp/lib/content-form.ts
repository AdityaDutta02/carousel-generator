// carousel-webapp/lib/content-form.ts
import type { ContentJson, FormField, FormFieldGroup, FieldType } from '@/types/carousel'

const SKIP_KEYS = new Set(['id', 'layout'])
const TEXTAREA_KEYS = new Set(['body', 'caption', 'quote'])

function inferFieldType(key: string, value: unknown): FieldType {
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return 'number'
  if (TEXTAREA_KEYS.has(key)) return 'textarea'
  return 'text'
}

function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

export function contentJsonToFormGroups(contentJson: ContentJson): FormFieldGroup[] {
  return contentJson.slides.map(slide => {
    const fields: FormField[] = []
    for (const [key, value] of Object.entries(slide)) {
      if (SKIP_KEYS.has(key)) continue
      const type = inferFieldType(key, value)
      fields.push({
        key,
        label: toLabel(key),
        type,
        value: value as string | string[] | number,
      })
    }
    return {
      slideId: slide.id,
      layout: slide.layout,
      fields,
    }
  })
}

export function applyFormChanges(
  contentJson: ContentJson,
  slideId: string,
  fieldKey: string,
  newValue: string | string[] | number
): ContentJson {
  return {
    ...contentJson,
    slides: contentJson.slides.map(slide => {
      if (slide.id !== slideId) return slide
      return { ...slide, [fieldKey]: newValue }
    }),
  }
}
