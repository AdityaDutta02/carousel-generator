'use client'
import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import type { Template, SchemaJson } from '@/types/template'

export function useTemplateSchema(templateId: string) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [schema, setSchema] = useState<SchemaJson | null>(null)
  const [templateHtml, setTemplateHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(templateId))

  useEffect(() => {
    if (!templateId) return
    const pb = getPocketBase()
    pb.collection('templates')
      .getOne(templateId)
      .then(record => {
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
          platformTags:
            typeof record.platform_tags === 'string'
              ? record.platform_tags.split(',').filter(Boolean)
              : [],
          slideCountDefault: (record.slide_count_default as number) || 5,
        }
        setTemplate(t)
        setSchema(t.schemaJson)
        return fetch(`/api/template/${templateId}`)
      })
      .then(res => res?.text())
      .then(html => { if (html) setTemplateHtml(html) })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [templateId])

  return { template, schema, templateHtml, isLoading }
}
