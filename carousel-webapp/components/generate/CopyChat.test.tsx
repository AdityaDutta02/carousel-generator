import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CopyChat } from './CopyChat'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}))

vi.mock('@/lib/pocketbase', () => ({
  getUserContext: vi.fn(() => null),
}))

describe('CopyChat', () => {
  it('renders the input field', () => {
    render(<CopyChat onCopyApproved={vi.fn()} />)
    expect(screen.getByPlaceholderText(/topic, article/i)).toBeInTheDocument()
  })

  it('shows quick-reply chips for platform selection', () => {
    render(<CopyChat onCopyApproved={vi.fn()} />)
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
  })

  it('calls onCopyApproved only when copy is approved', () => {
    const onApproved = vi.fn()
    render(<CopyChat onCopyApproved={onApproved} />)
    expect(onApproved).not.toHaveBeenCalled()
  })
})
