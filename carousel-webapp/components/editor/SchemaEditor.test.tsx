import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SchemaEditor } from './SchemaEditor'
import type { SchemaJson } from '@/types/template'

const schema: SchemaJson = {
  version: 1,
  slots: [
    {
      id: 's1_headline',
      slide: 1,
      selector: "[data-slot='s1_headline']",
      type: 'text',
      label: 'Headline',
      maxChars: 80,
    },
    {
      id: 'accent_color',
      slide: 'all',
      selector: ':root',
      type: 'css_var',
      variable: '--accent',
      label: 'Accent Color',
      default: '#E05828',
    },
  ],
}

describe('SchemaEditor', () => {
  it('renders label inputs for all defined slots', () => {
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Headline')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Accent Color')).toBeInTheDocument()
  })

  it('shows the type for each slot', () => {
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={vi.fn()} />)
    expect(screen.getAllByText('text').length).toBeGreaterThan(0)
    expect(screen.getAllByText('css_var').length).toBeGreaterThan(0)
  })

  it('calls onSchemaChange with updated label when label input changes', () => {
    const onSchemaChange = vi.fn()
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={onSchemaChange} />)
    const labelInput = screen.getByDisplayValue('Headline')
    fireEvent.change(labelInput, { target: { value: 'Cover Headline' } })
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots[0].label).toBe('Cover Headline')
  })

  it('removes a slot when Remove is clicked', () => {
    const onSchemaChange = vi.fn()
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={onSchemaChange} />)
    const removeButtons = screen.getAllByTitle('Remove slot')
    fireEvent.click(removeButtons[0])
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots).toHaveLength(1)
  })

  it('shows detected-but-undefined slot IDs from templateHtml', () => {
    const html = `<div data-slot="s2_headline">text</div><p data-slot="s2_body">body</p>`
    render(<SchemaEditor schema={{ version: 1, slots: [] }} templateHtml={html} onSchemaChange={vi.fn()} />)
    expect(screen.getByText('s2_headline')).toBeInTheDocument()
    expect(screen.getByText('s2_body')).toBeInTheDocument()
  })

  it('adds a detected slot when + Add is clicked', () => {
    const onSchemaChange = vi.fn()
    const html = `<div data-slot="s2_headline">text</div>`
    render(<SchemaEditor schema={{ version: 1, slots: [] }} templateHtml={html} onSchemaChange={onSchemaChange} />)
    fireEvent.click(screen.getByText('+ Add'))
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots[0].id).toBe('s2_headline')
  })
})
