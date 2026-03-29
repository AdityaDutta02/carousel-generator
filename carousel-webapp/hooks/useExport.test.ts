import { describe, it, expect } from 'vitest'
import { buildZipFilename } from './useExport'

describe('buildZipFilename', () => {
  it('slugifies the title', () => {
    expect(buildZipFilename('My Carousel Title')).toBe('my-carousel-title.zip')
  })

  it('handles special characters', () => {
    expect(buildZipFilename('Test & Demo!')).toBe('test-demo.zip')
  })

  it('falls back when title is empty', () => {
    expect(buildZipFilename('')).toBe('carousel.zip')
  })
})
