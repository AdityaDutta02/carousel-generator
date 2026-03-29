import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PngUploader } from './PngUploader'

describe('PngUploader', () => {
  it('renders the drop zone with drag and drop text', () => {
    render(<PngUploader onImagesChange={vi.fn()} />)
    expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument()
  })

  it('shows max file count', () => {
    render(<PngUploader onImagesChange={vi.fn()} maxFiles={3} />)
    expect(screen.getByText(/up to 3/i)).toBeInTheDocument()
  })

  it('calls onImagesChange with base64 data URLs when files selected', async () => {
    const onImagesChange = vi.fn()
    render(<PngUploader onImagesChange={onImagesChange} />)

    const file = new File(['fake-png-bytes'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    // Allow FileReader async to complete
    await new Promise(r => setTimeout(r, 50))
    expect(onImagesChange).toHaveBeenCalled()
    const arg: string[] = onImagesChange.mock.calls[0][0]
    expect(arg[0]).toMatch(/^data:image\//)
  })
})
