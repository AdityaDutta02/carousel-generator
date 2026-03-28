import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './useAuth'

vi.mock('@/lib/pocketbase', () => ({
  getPocketBase: vi.fn(() => ({
    authStore: {
      model: null,
      isValid: false,
      onChange: vi.fn(() => () => {}),
    },
    collection: vi.fn(() => ({
      authWithPassword: vi.fn().mockResolvedValue({ record: { id: 'u1' } }),
      create: vi.fn().mockResolvedValue({ id: 'u1' }),
    })),
  })),
}))

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
