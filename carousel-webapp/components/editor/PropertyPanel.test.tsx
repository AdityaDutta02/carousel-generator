import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PropertyPanel } from './PropertyPanel'
import type { SlotDefinition } from '@/types/template'

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
    <input data-testid="hex-picker" value={color} onChange={e => onChange(e.target.value)} />
  ),
}))

const textSlot: SlotDefinition = {
  id: 's1_headline',
  slide: 1,
  selector: "[data-slot='s1_headline']",
  type: 'text',
  label: 'Headline',
  maxChars: 80,
}

describe('PropertyPanel', () => {
  it('renders nothing when no slot selected', () => {
    const { container } = render(
      <PropertyPanel activeSlot={null} currentValue="" onChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders textarea for text slot', () => {
    render(
      <PropertyPanel activeSlot={textSlot} currentValue="hello" onChange={vi.fn()} />
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('shows character count', () => {
    render(
      <PropertyPanel activeSlot={textSlot} currentValue="hello" onChange={vi.fn()} />
    )
    expect(screen.getByText(/5 \/ 80/)).toBeInTheDocument()
  })

  it('calls onChange when text changes', () => {
    const onChange = vi.fn()
    render(<PropertyPanel activeSlot={textSlot} currentValue="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } })
    expect(onChange).toHaveBeenCalledWith('new value')
  })
})
