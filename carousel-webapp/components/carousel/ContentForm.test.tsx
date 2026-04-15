import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContentForm } from './ContentForm'
import type { FormFieldGroup } from '@/types/carousel'

const groups: FormFieldGroup[] = [
  {
    slideId: 's1',
    layout: 'cover',
    fields: [
      { key: 'topicTag', label: 'Topic Tag', type: 'text', value: 'FINANCE' },
      { key: 'headline', label: 'Headline', type: 'array', value: ['HDFC', 'CRASHED'] },
      { key: 'circledWord', label: 'Circled Word', type: 'number', value: 0 },
    ],
  },
]

describe('ContentForm', () => {
  it('renders a section per slide', () => {
    render(<ContentForm groups={groups} onChange={() => {}} />)
    expect(screen.getByText(/Slide 1/i)).toBeTruthy()
  })

  it('calls onChange when a text field changes', () => {
    const onChange = vi.fn()
    render(<ContentForm groups={groups} onChange={onChange} />)
    const input = screen.getByDisplayValue('FINANCE')
    fireEvent.change(input, { target: { value: 'TECH' } })
    expect(onChange).toHaveBeenCalledWith('s1', 'topicTag', 'TECH')
  })
})
