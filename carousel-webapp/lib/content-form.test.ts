import { describe, it, expect } from 'vitest'
import { contentJsonToFormGroups, applyFormChanges } from './content-form'
import type { ContentJson } from '@/types/carousel'

const sampleContent: ContentJson = {
  meta: { topic: 'Test', brand: 'Me', slideCount: 2, platform: 'LinkedIn' },
  slides: [
    {
      id: 's1',
      layout: 'cover',
      topicTag: 'FINANCE',
      categoryTag: 'BREAKING',
      headline: ['HDFC', 'CRASHED'],
      circledWord: 0,
      tagline: 'What happened.',
    },
    {
      id: 's2',
      layout: 'cta',
      eyebrow: 'FOLLOW',
      stmt: 'STAY AHEAD',
      body: 'Weekly breakdowns.',
      ctaLabel: 'FOLLOW ME',
    },
  ],
}

describe('contentJsonToFormGroups', () => {
  it('returns one group per slide', () => {
    const groups = contentJsonToFormGroups(sampleContent)
    expect(groups).toHaveLength(2)
    expect(groups[0].slideId).toBe('s1')
    expect(groups[0].layout).toBe('cover')
    expect(groups[1].slideId).toBe('s2')
    expect(groups[1].layout).toBe('cta')
  })

  it('marks string[] fields as array type', () => {
    const groups = contentJsonToFormGroups(sampleContent)
    const headlineField = groups[0].fields.find(f => f.key === 'headline')
    expect(headlineField?.type).toBe('array')
    expect(headlineField?.value).toEqual(['HDFC', 'CRASHED'])
  })

  it('marks number fields as number type', () => {
    const groups = contentJsonToFormGroups(sampleContent)
    const circledWordField = groups[0].fields.find(f => f.key === 'circledWord')
    expect(circledWordField?.type).toBe('number')
  })

  it('marks short strings as text, long strings as textarea', () => {
    const groups = contentJsonToFormGroups(sampleContent)
    const taglineField = groups[0].fields.find(f => f.key === 'tagline')
    // tagline is short, should be text
    expect(taglineField?.type).toBe('text')
  })
})

describe('applyFormChanges', () => {
  it('updates a string field on the correct slide', () => {
    const updated = applyFormChanges(sampleContent, 's2', 'stmt', 'NEW STMT')
    const slide = updated.slides.find(s => s.id === 's2') as { stmt: string }
    expect(slide.stmt).toBe('NEW STMT')
  })

  it('does not mutate the original', () => {
    const updated = applyFormChanges(sampleContent, 's1', 'topicTag', 'TECH')
    const original = sampleContent.slides.find(s => s.id === 's1') as { topicTag: string }
    expect(original.topicTag).toBe('FINANCE')
  })
})
