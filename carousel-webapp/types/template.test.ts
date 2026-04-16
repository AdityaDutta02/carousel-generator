import { describe, it, expect } from 'vitest'
import type { TemplateJson } from './template'

describe('TemplateJson', () => {
  it('accepts a minimal valid template', () => {
    const t: TemplateJson = {
      colors: { primary: '#F0EDE5', dark: '#111110', accent: '#E05828', white: '#FAFAF8' },
      typography: {
        display: { family: 'Barlow Condensed', weights: [900], googleFonts: 'family=Barlow+Condensed:wght@900' },
        body:    { family: 'DM Sans',          weights: [400], googleFonts: 'family=DM+Sans:wght@400' },
        serif:   { family: 'Lora',             weights: [400], googleFonts: 'family=Lora:ital,wght@1,400' },
      },
      typescale: {},
      spacing: { slidePadding: 72, cardPadding: 80, sectionGap: 44, cardRadius: 32, tagRadius: '100px' },
      components: {},
      slideLayouts: {},
      slideSequenceRules: {
        first: 'cover', last: 'cta', variation: 'alternate dark/light',
        recommended: { '6': ['cover', 'data', 'insight', 'card', 'quote', 'cta'] },
      },
      exportSettings: { deviceScaleFactor: 2, outputSize: '2160×2700px', logicalSize: '1080×1350px', format: 'PNG', exportScript: 'node export-slides.js' },
      generationRules: {},
    }
    expect(t.colors.accent).toBe('#E05828')
  })
})
