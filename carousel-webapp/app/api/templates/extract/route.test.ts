import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/models', () => ({
  completion: vi.fn(),
  VISION_MODEL: 'qwen/qwen2.5-vl-72b-instruct',
}))
vi.mock('@/lib/supertemplate', () => ({
  buildExtractionPrompt: () => 'Extract this template',
}))

import { POST } from './route'
import { completion } from '@/lib/models'

describe('POST /api/templates/extract', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 400 if images array is empty', async () => {
    const req = new Request('http://localhost/api/templates/extract', {
      method: 'POST',
      body: JSON.stringify({ images: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns templateJson on success', async () => {
    vi.mocked(completion).mockResolvedValueOnce(JSON.stringify({ colors: { accent: '#E05828' } }))
    const req = new Request('http://localhost/api/templates/extract', {
      method: 'POST',
      body: JSON.stringify({ images: ['base64data'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templateJson.colors.accent).toBe('#E05828')
  })

  it('returns 502 if model returns non-JSON', async () => {
    vi.mocked(completion).mockResolvedValueOnce('not json at all')
    const req = new Request('http://localhost/api/templates/extract', {
      method: 'POST',
      body: JSON.stringify({ images: ['data'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(502)
  })
})
