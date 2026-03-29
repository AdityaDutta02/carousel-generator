'use client'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { GeneratedCopy } from '@/types/carousel'

interface ScriptPreviewProps {
  copy: GeneratedCopy
  onCopyChange: (copy: GeneratedCopy) => void
  onConfirm: () => void
}
// SlideEditorProps drives the inline edit form rendered when a slide row is expanded.
interface SlideEditorProps {
  slideIndex: number
  headline: string
  body: string
  onFieldChange: (idx: number, field: 'headline' | 'body', value: string) => void
}

// SectionLabel is the shared uppercase caption rendered above Hook and CTA.
function SectionLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
      {children}
    </p>
  )
}

// SlideEditor renders two textareas for inline editing of a single slide's headline and body.
function SlideEditor({ slideIndex, headline, body, onFieldChange }: SlideEditorProps): ReactElement {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Textarea
        value={headline}
        onChange={(e) => onFieldChange(slideIndex, 'headline', e.target.value)}
        className="bg-zinc-900 border-zinc-700 text-white text-sm font-medium resize-none"
        rows={2}
      />
      <Textarea
        value={body}
        onChange={(e) => onFieldChange(slideIndex, 'body', e.target.value)}
        className="bg-zinc-900 border-zinc-700 text-zinc-300 text-sm resize-none"
        rows={3}
      />
    </div>
  )
}

export function ScriptPreview({ copy, onCopyChange, onConfirm }: ScriptPreviewProps): ReactElement {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  function updateSlide(idx: number, field: 'headline' | 'body', value: string): void {
    const slides = [...copy.slides]
    slides[idx] = { ...slides[idx], [field]: value }
    onCopyChange({ ...copy, slides })
  }

  function toggleEdit(i: number): void {
    setEditingIdx(editingIdx === i ? null : i)
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Hook</SectionLabel>
        <p className="text-lg font-semibold text-white">{copy.hook}</p>
      </div>
      <Separator className="bg-zinc-800" />
      <div className="space-y-4">
        {copy.slides.map((slide, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 p-4 cursor-pointer hover:border-zinc-600 transition-colors"
            onClick={() => toggleEdit(i)}
          >
            <p className="text-xs text-zinc-500 mb-1">Slide {i + 1}</p>
            {editingIdx === i ? (
              <SlideEditor
                slideIndex={i}
                headline={slide.headline}
                body={slide.body}
                onFieldChange={updateSlide}
              />
            ) : (
              <>
                <p className="font-medium text-white text-sm">{slide.headline}</p>
                <p className="text-zinc-400 text-sm mt-1">{slide.body}</p>
                {slide.stat && (
                  <Badge variant="outline" className="mt-2 text-xs">{slide.stat}</Badge>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div>
        <SectionLabel>CTA</SectionLabel>
        <p className="text-zinc-300">{copy.cta}</p>
      </div>
      <Button onClick={onConfirm} className="w-full">
        Choose Template →
      </Button>
    </div>
  )
}
