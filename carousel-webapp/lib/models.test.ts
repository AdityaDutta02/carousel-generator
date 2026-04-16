import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('completion', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  it('calls OpenRouter with correct model and messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello world' } }]
      })
    })

    const { completion } = await import('./models')
    const result = await completion({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(result).toBe('hello world')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"model":"deepseek/deepseek-chat"'),
      })
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    })
    const { completion } = await import('./models')
    await expect(
      completion({ model: 'deepseek/deepseek-chat', messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('429')
  })
})
