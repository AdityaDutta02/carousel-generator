import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/models', () => ({
  completion: vi.fn(),
  PLAN_MODEL: 'deepseek/deepseek-chat',
}))
vi.mock('@/lib/supertemplate', () => ({
  buildPlanPrompt: () => 'Plan this content',
}))

import { POST } from './route'
import { completion } from '@/lib/models'

const mockTemplateJson = { colors: {}, typography: { display: {}, body: {}, serif: {} }, typescale: {}, spacing: {}, components: {}, slideLayouts: {}, slideSequenceRules: { first: 'cover', last: 'cta', variation: '', recommended: {} }, exportSettings: {}, generationRules: {} }

describe('POST /api/carousels/plan', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 400 if content is missing', async () => {
    const req = new Request('http://localhost/api/carousels/plan', {
      method: 'POST',
      body: JSON.stringify({ templateJson: mockTemplateJson, slideCount: 6 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns contentJson on success', async () => {
    const mockContent = { meta: { topic: 'Test', brand: 'Me', slideCount: 2, platform: 'LinkedIn' }, slides: [] }
    vi.mocked(completion).mockResolvedValueOnce(JSON.stringify(mockContent))
    const req = new Request('http://localhost/api/carousels/plan', {
      method: 'POST',
      body: JSON.stringify({ content: 'Article text', templateJson: mockTemplateJson, slideCount: 6, brand: { brand: 'Me', platform: 'LinkedIn' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contentJson.meta.topic).toBe('Test')
  })
})
