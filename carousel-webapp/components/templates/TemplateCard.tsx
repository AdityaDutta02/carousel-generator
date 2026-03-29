'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { pb, publishTemplate, deleteTemplate } from '@/lib/pocketbase'
import type { Template } from '@/types/template'

interface TemplateCardProps {
  template: Template
  onSelect?: (template: Template) => void
  onPublished?: (updated: Template) => void
  onDelete?: (id: string) => void
  isSelected?: boolean
}

export function TemplateCard({ template, onSelect, onPublished, onDelete, isSelected }: TemplateCardProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const isAdmin = (pb.authStore.model as { role?: string } | null)?.role === 'admin'
  const canPublish = isAdmin && template.scope === 'user'
  const canDelete = template.scope === 'user'

  useEffect(() => {
    if (!template.htmlFileUrl || template.thumbnailUrl) return
    fetch(template.htmlFileUrl)
      .then(res => res.text())
      .then(html => setHtmlContent(html))
      .catch(() => {}) // silently ignore — "No preview" fallback handles it
  }, [template.htmlFileUrl, template.thumbnailUrl])

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Publish "${template.name}" to the system library? All users will see it.`)) return
    setIsPublishing(true)
    try {
      const updated = await publishTemplate(template.id)
      onPublished?.(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      await deleteTemplate(template.id)
      onDelete?.(template.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      data-testid="template-card"
      className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected ? 'border-orange-500' : 'border-zinc-800 hover:border-zinc-600'
      }`}
      onClick={() => onSelect?.(template)}
    >
      <div className="bg-zinc-900 aspect-[4/5] relative overflow-hidden">
        {template.thumbnailUrl ? (
          <Image
            src={template.thumbnailUrl}
            alt={template.name}
            fill
            className="object-cover"
          />
        ) : htmlContent ? (
          <iframe
            srcDoc={htmlContent}
            title={template.name}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '1080px',
              height: '1350px',
              transformOrigin: 'top left',
              transform: 'scale(0.25)',
              border: 'none',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
            No preview
          </div>
        )}
      </div>

      <div className="p-3 bg-zinc-950">
        <p className="text-sm font-medium text-white truncate">{template.name}</p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1 flex-wrap">
            {template.platformTags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
            ))}
            <Badge variant="outline" className="text-xs py-0">
              {template.canvasWidth}×{template.canvasHeight}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 ml-2 shrink-0">
            {template.scope === 'system' ? 'System' : 'My template'}
          </p>
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {canPublish && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-6 bg-zinc-900/90 border-zinc-600 hover:bg-orange-500 hover:border-orange-500 hover:text-white"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? '…' : 'Publish'}
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-6 bg-zinc-900/90 border-zinc-600 hover:bg-red-600 hover:border-red-600 hover:text-white"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? '…' : '✕'}
          </Button>
        )}
      </div>
    </div>
  )
}
