import { describe, it, expect } from 'vitest'
import { distributeFilledSlots } from '@/lib/slot-distribution'
import type { SlotDefinition } from '@/types/template'

describe('distributeFilledSlots', () => {
  const SLOTS: SlotDefinition[] = [
    { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent' },
    { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'S1 Headline' },
    { id: 's2_body', slide: 2, selector: "[data-slot='s2_body']", type: 'text', label: 'S2 Body' },
    { id: 's3_body', slide: 3, selector: "[data-slot='s3_body']", type: 'text', label: 'S3 Body' },
  ]

  it('puts global slots into every slide', () => {
    const filled = { accent: '#FF0000', s1_headline: 'Hello', s2_body: 'World' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result[0]['accent']).toBe('#FF0000')
    expect(result[1]['accent']).toBe('#FF0000')
  })

  it('puts per-slide slots into the correct slide index', () => {
    const filled = { s1_headline: 'H1', s2_body: 'B2' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result[0]['s1_headline']).toBe('H1')
    expect(result[0]['s2_body']).toBeUndefined()
    expect(result[1]['s2_body']).toBe('B2')
    expect(result[1]['s1_headline']).toBeUndefined()
  })

  it('ignores slots beyond slideCount', () => {
    const filled = { s3_body: 'Should be ignored' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result).toHaveLength(2)
    expect(result[0]['s3_body']).toBeUndefined()
    expect(result[1]['s3_body']).toBeUndefined()
  })

  it('ignores empty values', () => {
    const filled = { s1_headline: '' }
    const result = distributeFilledSlots(filled, SLOTS, 1)
    expect(result[0]['s1_headline']).toBeUndefined()
  })
})
