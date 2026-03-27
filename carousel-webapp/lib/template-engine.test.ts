import { describe, it, expect } from 'vitest'
import {
  injectSlotValues,
  injectBridgeScript,
  resolveSlotValue,
  getGlobalSlots,
  getSlideSlots,
} from './template-engine'
import type { SchemaJson } from '@/types/template'
import type { Slide } from '@/types/carousel'

const schema: SchemaJson = {
  version: 1,
  slots: [
    { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
    { id: 'accent_color', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent', default: '#E05828' },
  ],
}

const slide: Slide = {
  index: 0,
  slots: { s1_headline: 'Hello World', accent_color: '#FF0000' },
}

describe('injectSlotValues', () => {
  it('replaces data-slot text content', () => {
    const html = `<div data-slot="s1_headline">placeholder</div>`
    const result = injectSlotValues(html, schema, [slide], 0)
    expect(result).toContain('Hello World')
    expect(result).not.toContain('placeholder')
  })

  it('injects css var as style tag', () => {
    const html = `<html><head></head><body></body></html>`
    const result = injectSlotValues(html, schema, [slide], 0)
    expect(result).toContain('--accent')
    expect(result).toContain('#FF0000')
  })
})

describe('injectBridgeScript', () => {
  it('adds a script tag', () => {
    const html = `<html><head></head><body></body></html>`
    const result = injectBridgeScript(html, schema)
    expect(result).toContain('<script')
    expect(result).toContain('postMessage')
    expect(result).toContain('SLOT_CLICK')
  })
})

describe('getGlobalSlots', () => {
  it('returns only slots with slide === all', () => {
    const result = getGlobalSlots(schema)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('accent_color')
  })
})

describe('getSlideSlots', () => {
  it('returns slots for a specific slide number', () => {
    const result = getSlideSlots(schema, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1_headline')
  })
})

describe('resolveSlotValue', () => {
  it('returns slot value from slide', () => {
    expect(resolveSlotValue(schema.slots[0], slide)).toBe('Hello World')
  })

  it('returns default when slot has no value', () => {
    const emptySlide: Slide = { index: 0, slots: {} }
    expect(resolveSlotValue(schema.slots[1], emptySlide)).toBe('#E05828')
  })
})
