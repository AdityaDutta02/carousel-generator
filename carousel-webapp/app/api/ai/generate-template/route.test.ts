import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/openrouter', () => ({
  generateTemplate: vi.fn().mockResolvedValue('<html><body><div class="slide">mock</div></body></html>'),
}))

vi.mock('@/lib/pocketbase', () => ({
  verifyToken: vi.fn().mockResolvedValue({ id: 'user-1' }),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ai/generate-template', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
  })
}

describe('POST /api/ai/generate-template', () => {
  it('returns 400 when images array is empty', async () => {
    const res = await POST(makeRequest({ images: [] }))
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toMatch(/image/i)
  })

  it('returns 400 when more than 3 images provided', async () => {
    const res = await POST(makeRequest({ images: ['a', 'b', 'c', 'd'] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when image is not a data URL', async () => {
    const res = await POST(makeRequest({ images: ['https://example.com/img.png'] }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with html on success', async () => {
    const res = await POST(makeRequest({
      images: ['data:image/png;base64,abc123'],
      description: 'dark theme',
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { html: string }
    expect(json.html).toContain('<html>')
  })
})
