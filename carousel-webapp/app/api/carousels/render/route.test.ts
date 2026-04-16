import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/models', () => ({
  completion: vi.fn(),
  RENDER_MODEL: 'qwen/qwen2.5-coder-32b-instruct',
}))
vi.mock('@/lib/supertemplate', () => ({
  buildRenderPrompt: () => 'Render this carousel',
}))

import { POST } from './route'
import { completion } from '@/lib/models'

describe('POST /api/carousels/render', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 400 if contentJson is missing', async () => {
    const req = new Request('http://localhost/api/carousels/render', {
      method: 'POST',
      body: JSON.stringify({ templateJson: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns html on success, stripping markdown fences', async () => {
    vi.mocked(completion).mockResolvedValueOnce('```html\n<html><body>test</body></html>\n```')
    const req = new Request('http://localhost/api/carousels/render', {
      method: 'POST',
      body: JSON.stringify({
        contentJson: { meta: {}, slides: [] },
        templateJson: {},
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.html).toBe('<html><body>test</body></html>')
  })
})
