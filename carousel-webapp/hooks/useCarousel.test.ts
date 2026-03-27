import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCarousel } from './useCarousel'

vi.mock('@/lib/pocketbase', () => ({
  getPocketBase: vi.fn(),
  getCarousel: vi.fn().mockResolvedValue({
    id: 'c1',
    owner: 'u1',
    title: 'Test',
    templateId: '',
    platform: 'linkedin',
    canvasWidth: 1080,
    canvasHeight: 1350,
    slideCount: 3,
    slides: [],
    status: 'draft',
    created: '',
    updated: '',
  }),
  updateCarousel: vi.fn().mockResolvedValue({ id: 'c1' }),
}))

describe('useCarousel', () => {
  it('loads carousel by id', async () => {
    const { result } = renderHook(() => useCarousel('c1'))
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })
    expect(result.current.carousel?.id).toBe('c1')
  })

  it('exposes updateSlot function', () => {
    const { result } = renderHook(() => useCarousel('c1'))
    expect(typeof result.current.updateSlot).toBe('function')
  })
})
