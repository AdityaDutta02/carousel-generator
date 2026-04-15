import { describe, it, expect } from 'vitest'
import { buildExtractionPrompt, buildPlanPrompt, buildRenderPrompt } from './supertemplate'

const mockTemplateJson = {
  colors: { primary: '#F0EDE5', dark: '#111110', accent: '#E05828', white: '#FAFAF8' },
  typography: { display: { family: 'Barlow Condensed', weights: [900], googleFonts: '' }, body: { family: 'DM Sans', weights: [400], googleFonts: '' }, serif: { family: 'Lora', weights: [400], googleFonts: '' } },
  typescale: {},
  spacing: { slidePadding: 72, cardPadding: 80, sectionGap: 44, cardRadius: 32, tagRadius: '100px' },
  components: {},
  slideLayouts: { cover: { background: 'cream', foreground: 'dark', structure: 'space-between column', slots: {}, use: 'Slide 1 always' }, cta: { background: 'accent', foreground: 'white', structure: 'space-between column', slots: {}, use: 'Final slide' } },
  slideSequenceRules: { first: 'cover', last: 'cta', variation: 'alternate', recommended: { '4': ['cover', 'data', 'insight', 'cta'] } },
  exportSettings: { deviceScaleFactor: 2, outputSize: '2160x2700', logicalSize: '1080x1350', format: 'PNG', exportScript: 'node export.js' },
  generationRules: {},
}

describe('buildExtractionPrompt', () => {
  it('includes the supertemplate schema JSON', () => {
    const prompt = buildExtractionPrompt()
    expect(prompt).toContain('colors')
    expect(prompt).toContain('slideLayouts')
    expect(prompt).toContain('JSON')
  })
})

describe('buildPlanPrompt', () => {
  it('includes raw content and template JSON', () => {
    const prompt = buildPlanPrompt('My article about finance', mockTemplateJson, 6, { brand: 'Aditya', platform: 'LinkedIn' })
    expect(prompt).toContain('My article about finance')
    expect(prompt).toContain('LinkedIn')
    expect(prompt).toContain('6')
    expect(prompt).toContain('cover')
    expect(prompt).toContain('cta')
  })
})

describe('buildRenderPrompt', () => {
  it('includes template JSON and content JSON', () => {
    const contentJson = {
      meta: { topic: 'Test', brand: 'Me', slideCount: 2, platform: 'LinkedIn' as const },
      slides: [
        { id: 's1', layout: 'cover' as const, topicTag: 'FINANCE', categoryTag: 'BREAKING', headline: ['TEST'], circledWord: 0, tagline: 'A tagline' },
        { id: 's2', layout: 'cta' as const, eyebrow: 'FOLLOW', stmt: 'FOLLOW ME', body: 'body', ctaLabel: 'FOLLOW' },
      ]
    }
    const prompt = buildRenderPrompt(mockTemplateJson, contentJson)
    expect(prompt).toContain('1080')
    expect(prompt).toContain('1350')
    expect(prompt).toContain('s1')
    expect(prompt).toContain('FINANCE')
  })
})
