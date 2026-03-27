import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPocketBase, getUserContext } from './pocketbase'

// Don't actually connect to PocketBase in unit tests
vi.mock('pocketbase', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        authStore: { model: null, isValid: false },
        collection: vi.fn().mockReturnValue({
          getOne: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        }),
      }
    }),
  }
})

describe('getPocketBase', () => {
  it('returns a singleton — same instance on repeated calls', () => {
    const a = getPocketBase()
    const b = getPocketBase()
    expect(a).toBe(b)
  })
})

describe('getUserContext', () => {
  it('returns null when user has no profile', () => {
    const ctx = getUserContext(null)
    expect(ctx).toBeNull()
  })

  it('returns structured context when user has profile', () => {
    const model = {
      id: 'u1',
      brand_name: 'TestBrand',
      handle: '@test',
      target_audience: 'developers',
      tone: 'Casual',
      platform_preference: 'linkedin',
    }
    const ctx = getUserContext(model as Record<string, unknown>)
    expect(ctx).toMatchObject({
      brand: 'TestBrand',
      handle: '@test',
      audience: 'developers',
      tone: 'Casual',
      platform: 'linkedin',
    })
  })
})
