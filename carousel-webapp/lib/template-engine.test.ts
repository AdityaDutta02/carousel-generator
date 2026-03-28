import { describe, it, expect } from 'vitest'
import {
  injectSlotValues,
  injectBridgeScript,
  resolveSlotValue,
  getGlobalSlots,
  getSlideSlots,
  injectAllSlotValues,
  activateSlide,
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

// ── injectAllSlotValues ──────────────────────────────────────────────────
describe('injectAllSlotValues', () => {
  const MULTI_SLIDE_HTML = `<html><head></head><body>
<div class="slide active"><span data-slot="s1_headline">PH1</span></div>
<div class="slide"><span data-slot="s2_headline">PH2</span></div>
<div class="slide"><span data-slot="s3_headline">PH3</span></div>
</body></html>`

  const SCHEMA: SchemaJson = {
    version: 1,
    slots: [
      { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'S1 Headline' },
      { id: 's2_headline', slide: 2, selector: "[data-slot='s2_headline']", type: 'text', label: 'S2 Headline' },
      { id: 's3_headline', slide: 3, selector: "[data-slot='s3_headline']", type: 'text', label: 'S3 Headline' },
    ],
  }

  const SLIDES: Slide[] = [
    { index: 0, slots: { s1_headline: 'Hello Slide 1' } },
    { index: 1, slots: { s2_headline: 'Hello Slide 2' } },
    { index: 2, slots: { s3_headline: 'Hello Slide 3' } },
  ]

  it('injects values for all slides in one pass', () => {
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, SLIDES)
    expect(result).toContain('Hello Slide 1')
    expect(result).toContain('Hello Slide 2')
    expect(result).toContain('Hello Slide 3')
  })

  it('does not leave placeholder text for filled slots', () => {
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, SLIDES)
    expect(result).not.toContain('PH1')
    expect(result).not.toContain('PH2')
    expect(result).not.toContain('PH3')
  })

  it('leaves placeholder when slide has no slot value', () => {
    const sparseSlides: Slide[] = [
      { index: 0, slots: {} },
      { index: 1, slots: {} },
      { index: 2, slots: {} },
    ]
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, sparseSlides)
    expect(result).toContain('PH1')
  })
})

// ── activateSlide ────────────────────────────────────────────────────────
describe('activateSlide', () => {
  const HTML = `<html><body>
<div class="slide active">SLIDE1</div>
<div class="slide">SLIDE2</div>
<div class="slide">SLIDE3</div>
</body></html>`

  it('moves active class to the specified slide index', () => {
    const result = activateSlide(HTML, 1)
    const matches = [...result.matchAll(/class="slide(?: active)?"/g)]
    expect(matches[0][0]).toBe('class="slide"')
    expect(matches[1][0]).toBe('class="slide active"')
    expect(matches[2][0]).toBe('class="slide"')
  })

  it('keeps slide 0 active when index is 0', () => {
    const result = activateSlide(HTML, 0)
    const matches = [...result.matchAll(/class="slide(?: active)?"/g)]
    expect(matches[0][0]).toBe('class="slide active"')
  })

  it('returns html unchanged when slideIndex is out of range', () => {
    const result = activateSlide(HTML, 99)
    expect(result).toBe(HTML)
  })
})
