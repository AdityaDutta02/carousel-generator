import { describe, it, expect } from 'vitest'
import { getPocketBaseUrl } from './pocketbase'

describe('getPocketBaseUrl', () => {
  it('returns NEXT_PUBLIC_POCKETBASE_URL if set', () => {
    process.env.NEXT_PUBLIC_POCKETBASE_URL = 'http://test:8090'
    expect(getPocketBaseUrl()).toBe('http://test:8090')
  })

  it('falls back to localhost if env var not set', () => {
    delete process.env.NEXT_PUBLIC_POCKETBASE_URL
    expect(getPocketBaseUrl()).toBe('http://127.0.0.1:8090')
  })
})
