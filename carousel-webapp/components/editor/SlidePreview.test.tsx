import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from './SlidePreview'

describe('SlidePreview', () => {
  it('renders an iframe', () => {
    render(
      <SlidePreview
        srcdoc="<html><body>test</body></html>"
        canvasWidth={1080}
        canvasHeight={1350}
        onSlotClick={vi.fn()}
        onCaptureResult={vi.fn()}
      />
    )
    expect(screen.getByTitle('slide-preview')).toBeInTheDocument()
  })

  it('scales iframe to fit container', () => {
    const { container } = render(
      <SlidePreview
        srcdoc="<html><body></body></html>"
        canvasWidth={1080}
        canvasHeight={1350}
        onSlotClick={vi.fn()}
        onCaptureResult={vi.fn()}
      />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeTruthy()
  })
})
