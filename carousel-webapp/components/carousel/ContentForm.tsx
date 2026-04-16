'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { FormFieldGroup } from '@/types/carousel'

interface ContentFormProps {
  groups: FormFieldGroup[]
  onChange: (slideId: string, fieldKey: string, value: string | string[] | number) => void
}

function ArrayField({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const text = value.join('\n')
  return (
    <Textarea
      value={text}
      onChange={e => onChange(e.target.value.split('\n'))}
      rows={Math.max(2, value.length + 1)}
      className="font-mono text-sm"
    />
  )
}

export function ContentForm({ groups, onChange }: ContentFormProps) {
  const [openSlides, setOpenSlides] = useState<Set<string>>(new Set(groups.map(g => g.slideId)))

  function toggleSlide(slideId: string) {
    setOpenSlides(prev => {
      const next = new Set(prev)
      if (next.has(slideId)) next.delete(slideId)
      else next.add(slideId)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {groups.map((group, i) => (
        <div key={group.slideId} className="border rounded-md overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => toggleSlide(group.slideId)}
          >
            <span>Slide {i + 1} — {group.layout}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{group.slideId}</Badge>
              <span className="text-muted-foreground">{openSlides.has(group.slideId) ? '▲' : '▼'}</span>
            </div>
          </button>

          {openSlides.has(group.slideId) && (
            <div className="px-4 pb-4 space-y-4 border-t">
              {group.fields.map(field => (
                <div key={field.key}>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {field.label}
                  </Label>
                  {field.type === 'array' ? (
                    <ArrayField
                      value={field.value as string[]}
                      onChange={v => onChange(group.slideId, field.key, v)}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      value={String(field.value)}
                      onChange={e => onChange(group.slideId, field.key, e.target.value)}
                      rows={3}
                      className="text-sm mt-1"
                    />
                  ) : field.type === 'number' ? (
                    <Input
                      type="number"
                      value={Number(field.value)}
                      onChange={e => onChange(group.slideId, field.key, Number(e.target.value))}
                      className="text-sm mt-1"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={String(field.value)}
                      onChange={e => onChange(group.slideId, field.key, e.target.value)}
                      className="text-sm mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
