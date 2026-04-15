'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createPocketBaseClient, getTemplates, createCarousel } from '@/lib/pocketbase'
import type { TemplateRecord } from '@/lib/pocketbase'
import type { ContentJson } from '@/types/carousel'

type Step = 1 | 2 | 3

export default function NewCarouselPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null)

  // Step 2 state
  const [content, setContent] = useState('')
  const [slideCount, setSlideCount] = useState(6)
  const [platform, setPlatform] = useState<'LinkedIn' | 'Instagram'>('LinkedIn')
  const [carouselName, setCarouselName] = useState('')

  // Step 3 state (generation)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<'idle' | 'planning' | 'rendering' | 'saving'>('idle')
  const [genError, setGenError] = useState<string | null>(null)

  useEffect(() => {
    const pb = createPocketBaseClient()
    getTemplates(pb)
      .then(setTemplates)
      .catch((err: unknown) => console.error('Failed to load templates:', err))
      .finally(() => setLoadingTemplates(false))
  }, [])

  async function handleGenerate() {
    if (!selectedTemplate || !content.trim() || !carouselName.trim()) return
    setGenerating(true)
    setGenError(null)

    try {
      // Step 1: Plan
      setGenStatus('planning')
      const planRes = await fetch('/api/carousels/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          templateJson: selectedTemplate.template_json,
          slideCount,
          brand: { brand: carouselName, platform },
        }),
      })
      const planData = await planRes.json() as { contentJson?: ContentJson; error?: string }
      if (!planRes.ok || !planData.contentJson) throw new Error(planData.error ?? 'Planning failed')
      const contentJson = planData.contentJson

      // Step 2: Render
      setGenStatus('rendering')
      const renderRes = await fetch('/api/carousels/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentJson,
          templateJson: selectedTemplate.template_json,
        }),
      })
      const renderData = await renderRes.json() as { html?: string; error?: string }
      if (!renderRes.ok || !renderData.html) throw new Error(renderData.error ?? 'Rendering failed')
      const html = renderData.html

      // Step 3: Save
      setGenStatus('saving')
      const pb = createPocketBaseClient()
      const carousel = await createCarousel(pb, {
        name: carouselName.trim(),
        template_id: selectedTemplate.id,
        content_json: contentJson,
        html_cache: html,
        slide_count: slideCount,
        platform,
      })

      router.push(`/carousels/${carousel.id}`)
    } catch (err) {
      setGenError(String(err))
      setGenerating(false)
      setGenStatus('idle')
    }
  }

  const statusLabels: Record<'idle' | 'planning' | 'rendering' | 'saving', string> = {
    idle: '',
    planning: 'Planning slides…',
    rendering: 'Rendering HTML…',
    saving: 'Saving…',
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">New Carousel</h1>

      <div className="flex gap-2 mb-8 text-sm">
        {(['1. Template', '2. Content', '3. Generate'] as const).map((label, i) => (
          <span
            key={label}
            className={`px-3 py-1 rounded-full ${step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Pick a template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground">Loading templates…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No templates available.{' '}
                <a href="/templates/new" className="underline">Create one first.</a>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`border rounded-lg p-3 text-left text-sm transition-colors ${selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'}`}
                  >
                    <p className="font-medium">{t.name}</p>
                    {t.is_system && <p className="text-xs text-muted-foreground">System template</p>}
                  </button>
                ))}
              </div>
            )}
            <Button onClick={() => setStep(2)} disabled={!selectedTemplate}>
              Continue →
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Content &amp; settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="carousel-name">Carousel name</Label>
              <Input
                id="carousel-name"
                placeholder="e.g. HDFC Crash Breakdown"
                value={carouselName}
                onChange={e => setCarouselName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="content">Raw content</Label>
              <Textarea
                id="content"
                placeholder="Paste your article, newsletter, bullet points, or script here…"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                className="mt-1"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="slide-count">Slide count</Label>
                <Input
                  id="slide-count"
                  type="number"
                  min={4}
                  max={10}
                  value={slideCount}
                  onChange={e => setSlideCount(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="platform">Platform</Label>
                <select
                  id="platform"
                  value={platform}
                  onChange={e => setPlatform(e.target.value as 'LinkedIn' | 'Instagram')}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option>LinkedIn</option>
                  <option>Instagram</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={!content.trim() || !carouselName.trim()}>
                Generate →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Generate</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Template: <strong>{selectedTemplate?.name}</strong></p>
              <p>Slides: <strong>{slideCount}</strong> · Platform: <strong>{platform}</strong></p>
            </div>
            {genStatus !== 'idle' && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${genStatus === 'planning' || genStatus === 'rendering' || genStatus === 'saving' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <span className={genStatus === 'planning' ? 'animate-spin' : ''}>◉</span>
                  Planning slides…
                  {genStatus !== 'planning' && <span className="text-green-600">✓</span>}
                </div>
                {(genStatus === 'rendering' || genStatus === 'saving') && (
                  <div className={`flex items-center gap-2 text-sm ${genStatus === 'rendering' || genStatus === 'saving' ? 'text-primary' : 'text-muted-foreground'}`}>
                    <span className={genStatus === 'rendering' ? 'animate-spin' : ''}>◉</span>
                    Rendering HTML…
                    {genStatus === 'saving' && <span className="text-green-600">✓</span>}
                  </div>
                )}
              </div>
            )}
            {genError && <p className="text-sm text-destructive">{genError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={generating}>← Back</Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? statusLabels[genStatus] || 'Generating…' : 'Generate Carousel'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
