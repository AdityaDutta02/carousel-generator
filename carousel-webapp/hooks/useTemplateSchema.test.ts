import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTemplateSchema } from './useTemplateSchema'

const mockPbInstance = {
  collection: vi.fn(() => ({
    getOne: vi.fn().mockResolvedValue({
      id: 't1',
      name: 'Editorial',
      scope: 'system',
      owner: null,
      schema_json: {
        version: 1,
        slots: [
          { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
        ],
      },
      canvas_width: 1080,
      canvas_height: 1350,
      slide_count_default: 8,
      platform_tags: ['linkedin'],
      html_file: 'template.html',
      thumbnail: '',
    }),
  })),
  files: { getURL: vi.fn(() => 'http://test/template.html') },
}

vi.mock('pocketbase', () => ({
  default: vi.fn(() => ({
    collection: vi.fn(() => ({
      getOne: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'Editorial',
        scope: 'system',
        owner: null,
        schema_json: {
          version: 1,
          slots: [
            { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
          ],
        },
        canvas_width: 1080,
        canvas_height: 1350,
        slide_count_default: 8,
        platform_tags: ['linkedin'],
        html_file: 'template.html',
        thumbnail: '',
      }),
    })),
    files: { getURL: vi.fn(() => 'http://test/template.html') },
  })),
}))

vi.mock('@/lib/pocketbase', () => ({
  getPocketBase: vi.fn(() => mockPbInstance),
}))

describe('useTemplateSchema', () => {
  it('loads template schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: () => Promise.resolve('<html/>') }))
    const { result } = renderHook(() => useTemplateSchema('t1'))
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(result.current.template?.id).toBe('t1')
    expect(result.current.schema?.slots).toHaveLength(1)
    vi.unstubAllGlobals()
  })

  it('returns null when no templateId', () => {
    const { result } = renderHook(() => useTemplateSchema(''))
    expect(result.current.template).toBeNull()
    expect(result.current.schema).toBeNull()
  })
})
