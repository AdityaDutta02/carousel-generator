import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockModel = {
  id: 'user1',
  brand_name: '',
  display_name: 'Aditya',
  handle: '@aditya',
  accent_color: '#E05828',
  tone: 'Professional',
  target_audience: '',
  platform_preference: 'LinkedIn',
}

const mockUpdate = vi.fn().mockResolvedValue({ ...mockModel, brand_name: 'TestBrand' })

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    authStore: {
      model: mockModel,
      onChange: vi.fn(() => () => {}),
    },
    collection: vi.fn(() => ({ update: mockUpdate })),
  },
}))

const { useBrandProfile } = await import('./useBrandProfile')

describe('useBrandProfile', () => {
  it('returns isFilled=false when brand_name is empty', () => {
    const { result } = renderHook(() => useBrandProfile())
    expect(result.current.isFilled).toBe(false)
  })

  it('exposes profile fields mapped from auth model', () => {
    const { result } = renderHook(() => useBrandProfile())
    expect(result.current.profile.displayName).toBe('Aditya')
    expect(result.current.profile.handle).toBe('@aditya')
  })

  it('calls pb.collection("users").update when save is called', async () => {
    const { result } = renderHook(() => useBrandProfile())
    await act(async () => {
      await result.current.save({ brandName: 'TestBrand' })
    })
    expect(mockUpdate).toHaveBeenCalledWith('user1', { brand_name: 'TestBrand' })
  })
})
