import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so these are available inside the hoisted vi.mock factory
const { mockUpdate, mockCollection } = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockResolvedValue({ id: 'tpl1', scope: 'system', owner: null })
  const mockCollection = vi.fn().mockReturnValue({
    getOne: vi.fn(),
    create: vi.fn(),
    update: mockUpdate,
  })
  return { mockUpdate, mockCollection }
})

// Don't actually connect to PocketBase in unit tests
vi.mock('pocketbase', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        authStore: { model: null, isValid: false, onChange: vi.fn(() => () => {}) },
        collection: mockCollection,
      }
    }),
  }
})

import { getPocketBase, getUserContext, publishTemplate } from './pocketbase'

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

describe('publishTemplate', () => {
  beforeEach(() => {
    mockUpdate.mockClear()
    mockCollection.mockClear()
    mockUpdate.mockResolvedValue({ id: 'tpl1', scope: 'system', owner: null })
    // Restore mockCollection return value after clear
    mockCollection.mockReturnValue({
      getOne: vi.fn(),
      create: vi.fn(),
      update: mockUpdate,
    })
  })

  it('calls collection(templates).update with scope=system and owner=null', async () => {
    const result = await publishTemplate('tpl1')
    expect(mockCollection).toHaveBeenCalledWith('templates')
    expect(mockUpdate).toHaveBeenCalledWith('tpl1', { scope: 'system', owner: null })
    expect(result.scope).toBe('system')
  })
})
