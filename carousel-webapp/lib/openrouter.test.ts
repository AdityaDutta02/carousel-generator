import { describe, it, expect } from 'vitest'
import { buildCopyGenSystemPrompt, buildSlotFillPrompt } from './openrouter'
import type { UserContext } from './pocketbase'
import type { SlotDefinition } from '@/types/template'
import type { GeneratedCopy } from '@/types/carousel'

const mockCtx: UserContext = {
  brand: 'FinanceFirst',
  handle: '@ff',
  audience: 'retail investors',
  tone: 'bold',
  platform: 'linkedin',
  ctaDefault: 'Follow for more',
}

describe('buildCopyGenSystemPrompt', () => {
  it('includes user context', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('FinanceFirst')
    expect(prompt).toContain('retail investors')
    expect(prompt).toContain('linkedin')
  })

  it('enforces JSON-only output rule', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('JSON only')
  })

  it('includes word limits', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('12 words')
    expect(prompt).toContain('8 words')
    expect(prompt).toContain('40 words')
  })
})

describe('buildSlotFillPrompt', () => {
  it('includes slot ids from schema', () => {
    const schema: SlotDefinition[] = [
      { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', maxChars: 80, label: 'Headline' },
    ]
    const copy: GeneratedCopy = { hook: 'hook text', slides: [{ headline: 'H', body: 'B' }], cta: 'follow' }
    const prompt = buildSlotFillPrompt(schema, copy)
    expect(prompt).toContain('s1_headline')
    expect(prompt).toContain('80')
  })
})
