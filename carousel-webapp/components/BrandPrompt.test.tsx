import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockSave = vi.fn().mockResolvedValue(undefined)

vi.mock('@/hooks/useBrandProfile', () => ({
  useBrandProfile: vi.fn(() => ({
    profile: {
      displayName: '',
      brandName: '',
      handle: '',
      accentColor: '#E05828',
      tone: 'Professional',
      targetAudience: '',
      platformPreference: 'LinkedIn',
    },
    isFilled: false,
    save: mockSave,
    isSaving: false,
  })),
}))

const { BrandPrompt } = await import('./BrandPrompt')

// Provide a functional localStorage stub for jsdom environments that lack URL context.
const localStorageStore: Record<string, string> = {}
const localStorageStub: Storage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) },
  get length() { return Object.keys(localStorageStore).length },
  key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
}
vi.stubGlobal('localStorage', localStorageStub)

beforeEach(() => {
  localStorageStub.clear()
  vi.clearAllMocks()
})

describe('BrandPrompt', () => {
  it('renders the prompt headline', () => {
    render(<BrandPrompt />)
    expect(screen.getByText(/save your brand/i)).toBeInTheDocument()
  })

  it('calls onDismiss when Skip is clicked', () => {
    const onDismiss = vi.fn()
    render(<BrandPrompt onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it("sets localStorage flag when Don't ask again is clicked", () => {
    render(<BrandPrompt />)
    fireEvent.click(screen.getByRole('button', { name: /don.t ask again/i }))
    expect(localStorage.getItem('brand_prompt_dismissed')).toBe('true')
  })

  it('calls save and onDismiss when form is submitted with a brand name', async () => {
    const onDismiss = vi.fn()
    render(<BrandPrompt onDismiss={onDismiss} />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), {
      target: { value: 'FinanceFirst' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save brand/i }))
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    expect(onDismiss).toHaveBeenCalled()
  })
})
