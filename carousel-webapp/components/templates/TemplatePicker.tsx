'use client'
import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { TemplateCard } from './TemplateCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { Template, SchemaJson } from '@/types/template'

function parsePlatformTags(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') return value.split(',').filter(Boolean)
  return []
}

interface TemplatePickerProps {
  onSelect: (template: Template) => void
  selectedId?: string
}

export function TemplatePicker({ onSelect, selectedId }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const pb = getPocketBase()
    pb.collection('templates')
      .getList(1, 50, { sort: 'scope,name', requestKey: 'template-list' })
      .then(result => {
        setTemplates(result.items.map(r => ({
          id: r.id,
          name: r.name as string,
          scope: r.scope as 'system' | 'user',
          owner: r.owner as string | null,
          htmlFileUrl: pb.files.getURL(r, r.html_file as string),
          schemaJson: r.schema_json as SchemaJson,
          thumbnailUrl: r.thumbnail ? pb.files.getURL(r, r.thumbnail as string) : '',
          canvasWidth: r.canvas_width as number,
          canvasHeight: r.canvas_height as number,
          platformTags: parsePlatformTags(r.platform_tags),
          slideCountDefault: r.slide_count_default as number,
        })))
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
        ))}
      </div>
    )
  }

  function handleDelete(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {templates.map(t => (
        <TemplateCard
          key={t.id}
          template={t}
          onSelect={onSelect}
          onDelete={handleDelete}
          isSelected={t.id === selectedId}
        />
      ))}
    </div>
  )
}
