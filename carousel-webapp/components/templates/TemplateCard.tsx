'use client'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import type { Template } from '@/types/template'

interface TemplateCardProps {
  template: Template
  onSelect?: (template: Template) => void
  isSelected?: boolean
}

export function TemplateCard({ template, onSelect, isSelected }: TemplateCardProps) {
  return (
    <div
      data-testid="template-card"
      className={`rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected ? 'border-orange-500' : 'border-zinc-800 hover:border-zinc-600'
      }`}
      onClick={() => onSelect?.(template)}
    >
      <div className="bg-zinc-900 aspect-[4/5] relative">
        {template.thumbnailUrl ? (
          <Image
            src={template.thumbnailUrl}
            alt={template.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
            No preview
          </div>
        )}
      </div>
      <div className="p-3 bg-zinc-950">
        <p className="text-sm font-medium text-white truncate">{template.name}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {template.platformTags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
          ))}
          <Badge variant="outline" className="text-xs py-0">
            {template.canvasWidth}×{template.canvasHeight}
          </Badge>
        </div>
      </div>
    </div>
  )
}
