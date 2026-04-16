import { describe, it, expect, vi } from 'vitest'

// We test the module shape — actual export is browser-only
describe('export module', () => {
  it('exports exportCarouselAsZip function', async () => {
    const mod = await import('./export')
    expect(typeof mod.exportCarouselAsZip).toBe('function')
  })
})
