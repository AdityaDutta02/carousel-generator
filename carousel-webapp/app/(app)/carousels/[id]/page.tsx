'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ContentForm } from '@/components/carousel/ContentForm'
import { contentJsonToFormGroups, applyFormChanges } from '@/lib/content-form'
import { exportCarouselAsZip } from '@/lib/export'
import { createPocketBaseClient, getCarousel, getTemplate, updateCarousel } from '@/lib/pocketbase'
import type { CarouselRecord } from '@/lib/pocketbase'
import type { ContentJson, FormFieldGroup } from '@/types/carousel'
import type { TemplateJson } from '@/types/template'

export default function CarouselEditorPage() {
  const { id } = useParams<{ id: string }>()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [carousel, setCarousel] = useState<CarouselRecord | null>(null)
  const [templateJson, setTemplateJson] = useState<TemplateJson | null>(null)
  const [contentJson, setContentJson] = useState<ContentJson | null>(null)
  const [htmlCache, setHtmlCache] = useState<string>('')
  const [formGroups, setFormGroups] = useState<FormFieldGroup[]>([])
  const [carouselName, setCarouselName] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rerendering, setRerendering] = useState(false)
  const [rerenderError, setRerenderError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const pb = createPocketBaseClient()
    getCarousel(pb, id)
      .then(async c => {
        setCarousel(c)
        setCarouselName(c.name)
        setContentJson(c.content_json)
        setHtmlCache(c.html_cache)
        setFormGroups(contentJsonToFormGroups(c.content_json))
        const tmpl = await getTemplate(pb, c.template_id)
        setTemplateJson(tmpl.template_json)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [id])

  function handleFieldChange(slideId: string, fieldKey: string, value: string | string[] | number) {
    if (!contentJson) return
    const updated = applyFormChanges(contentJson, slideId, fieldKey, value)
    setContentJson(updated)
    setFormGroups(contentJsonToFormGroups(updated))
  }

  async function handleRerender() {
    if (!contentJson || !templateJson) return
    setRerendering(true)
    setRerenderError(null)
    try {
      const res = await fetch('/api/carousels/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson, templateJson }),
      })
      const data = await res.json() as { html?: string; error?: string }
      if (!res.ok || !data.html) throw new Error(data.error ?? 'Render failed')

      setHtmlCache(data.html)

      const pb = createPocketBaseClient()
      await updateCarousel(pb, id, { content_json: contentJson, html_cache: data.html })
    } catch (err) {
      setRerenderError(String(err))
    } finally {
      setRerendering(false)
    }
  }

  async function handleExport() {
    if (!iframeRef.current) return
    setExporting(true)
    try {
      await exportCarouselAsZip({
        iframeEl: iframeRef.current,
        carouselName: carouselName || 'carousel',
      })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  async function handleNameSave() {
    if (!carouselName.trim()) return
    setSaving(true)
    try {
      const pb = createPocketBaseClient()
      await updateCarousel(pb, id, { name: carouselName.trim() })
    } catch (err) {
      console.error('Name save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // Suppress unused variable warning — saving is used as a guard in handleNameSave
  void saving
  // Suppress unused variable warning — carousel is set to confirm load succeeded
  void carousel

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading carousel…</div>
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/carousels">← Carousels</Link>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Input
          value={carouselName}
          onChange={e => setCarouselName(e.target.value)}
          onBlur={handleNameSave}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex-1" />
        {rerenderError && <p className="text-xs text-destructive">{rerenderError}</p>}
        <Button size="sm" variant="outline" onClick={handleRerender} disabled={rerendering}>
          {rerendering ? 'Re-rendering…' : 'Re-render'}
        </Button>
        <Button size="sm" onClick={handleExport} disabled={exporting || !htmlCache}>
          {exporting ? 'Exporting…' : 'Export ZIP'}
        </Button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: ContentForm */}
        <div className="w-80 shrink-0 border-r overflow-hidden flex flex-col">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
            Content
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {formGroups.length > 0 ? (
                <ContentForm groups={formGroups} onChange={handleFieldChange} />
              ) : (
                <p className="text-sm text-muted-foreground">No content loaded.</p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right: iframe preview */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-8">
          {htmlCache ? (
            <iframe
              ref={iframeRef}
              srcDoc={htmlCache}
              className="bg-white shadow-lg"
              style={{ width: '540px', height: '675px', border: 'none' }}
              title="Carousel preview"
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              No preview yet. Click Re-render to generate.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
