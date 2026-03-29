'use client'
import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import type { Template, SchemaJson } from '@/types/template'

function parsePlatformTags(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') return value.split(',').filter(Boolean)
  return []
}

export function useTemplateSchema(templateId: string) {
  const [state, setState] = useState<{
    id: string
    template: Template | null
    schema: SchemaJson | null
    templateHtml: string | null
    isLoading: boolean
  }>({
    id: templateId,
    template: null,
    schema: null,
    templateHtml: null,
    isLoading: Boolean(templateId),
  })

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    const pb = getPocketBase()
    pb.collection('templates')
      .getOne(templateId, { requestKey: null })
      .then(record => {
        if (cancelled) return undefined
        const t: Template = {
          id: record.id,
          name: record.name as string,
          scope: record.scope as 'system' | 'user',
          owner: record.owner as string | null,
          htmlFileUrl: pb.files.getURL(record, record.html_file as string),
          schemaJson: record.schema_json as SchemaJson,
          thumbnailUrl: record.thumbnail
            ? pb.files.getURL(record, record.thumbnail as string)
            : '',
          canvasWidth: (record.canvas_width as number) || 1080,
          canvasHeight: (record.canvas_height as number) || 1350,
          platformTags: parsePlatformTags(record.platform_tags),
          slideCountDefault: (record.slide_count_default as number) || 5,
        }
        setState(prev => ({ ...prev, id: templateId, template: t, schema: t.schemaJson }))
        return fetch(`/api/template/${templateId}`, {
          headers: pb.authStore.token
            ? { Authorization: `Bearer ${pb.authStore.token}` }
            : {},
        })
      })
      .then(res => (res?.ok ? res.text() : undefined))
      .then(html => {
        if (cancelled) return
        if (html) setState(prev => ({ ...prev, id: templateId, templateHtml: html }))
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setState(prev => (prev.id === templateId ? { ...prev, isLoading: false } : prev))
      })
    return () => { cancelled = true }
  }, [templateId])

  const isCurrent = state.id === templateId
  const template = isCurrent ? state.template : null
  const schema = isCurrent ? state.schema : null
  const templateHtml = isCurrent ? state.templateHtml : null
  const isLoading = !isCurrent || state.isLoading

  return { template, schema, templateHtml, isLoading }
}
