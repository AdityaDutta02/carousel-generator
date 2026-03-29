'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PngUploader } from '@/components/templates/PngUploader'
import { SchemaEditor } from '@/components/editor/SchemaEditor'
import { PropertyPanel } from '@/components/editor/PropertyPanel'
import { SlidePreview, type SlidePreviewHandle } from '@/components/editor/SlidePreview'
import { buildSrcdoc } from '@/lib/template-engine'
import { pb } from '@/lib/pocketbase'
import type { SchemaJson, SlotDefinition } from '@/types/template'
import type { Slide } from '@/types/carousel'

type Step = 'upload' | 'generating' | 'editing'
type PanelTab = 'edit' | 'schema'

interface SidePanelTabsProps {
  activeTab: PanelTab
  onTabChange: (tab: PanelTab) => void
  editContent: React.ReactNode
  schemaContent: React.ReactNode
}

function SidePanelTabs({ activeTab, onTabChange, editContent, schemaContent }: SidePanelTabsProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="mx-4 mt-4 grid grid-cols-2 bg-zinc-900 rounded-md p-1 shrink-0">
        {(['edit', 'schema'] as PanelTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            data-testid={`panel-tab-${tab}`}
            onClick={() => onTabChange(tab)}
            className={[
              'rounded px-3 py-1.5 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'edit' ? editContent : schemaContent}
      </div>
    </div>
  )
}

function inferMaxChars(id: string): number {
  const lower = id.toLowerCase()
  // Single-word split-headline slots (circled line N, step N, point N, line N)
  if (/(?:circled|line|step|point)\s*(?:one|two|three|four|five|six|\d)/.test(lower)) return 15
  // Headline / hook — short punchy phrase
  if (/headline|hook|title/.test(lower)) return 40
  // Stats / numbers
  if (/stat|number|figure|count|metric/.test(lower)) return 10
  // Category / label / tag / date — very short
  if (/categor|label|tag|date|brand|handle|source/.test(lower)) return 20
  // CTA / action
  if (/cta|action|follow|button/.test(lower)) return 30
  // Body / description — longest
  if (/body|text|description|content|caption|note|quote|pull/.test(lower)) return 120
  return 80
}

function autoDetectSchema(html: string): SchemaJson {
  const ids = [...new Set([...html.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]))]
  const slots: SlotDefinition[] = ids.map(id => {
    const label = id.replace(/_/g, ' ').replace(/^s\d+ /, '')
    return {
      id,
      slide: 1,
      selector: `[data-slot='${id}']`,
      type: 'text',
      label,
      maxChars: inferMaxChars(id),
    }
  })
  return { version: 1, slots }
}

export default function NewTemplatePage() {
  const router = useRouter()
  const previewRef = useRef<SlidePreviewHandle>(null)

  const [step, setStep] = useState<Step>('upload')
  const [images, setImages] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [templateHtml, setTemplateHtml] = useState('')
  const [schema, setSchema] = useState<SchemaJson>({ version: 1, slots: [] })
  const [slides, setSlides] = useState<Slide[]>([{ index: 0, slots: {} }])
  const [activeSlot, setActiveSlot] = useState<SlotDefinition | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>('edit')
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0)

  // captureResolve holds the resolve function for the in-flight capture promise
  const captureResolve = useRef<((dataUrl: string | null) => void) | null>(null)

  const handleCaptureResult = useCallback((dataUrl: string | null) => {
    if (captureResolve.current) {
      captureResolve.current(dataUrl)
      captureResolve.current = null
    }
  }, [])

  const requestCapture = useCallback((): Promise<string | null> => {
    return new Promise(resolve => {
      captureResolve.current = resolve
      previewRef.current?.capture()
      // Timeout after 5 s to avoid hanging the save flow
      setTimeout(() => {
        if (captureResolve.current) {
          captureResolve.current(null)
          captureResolve.current = null
        }
      }, 5000)
    })
  }, [])

  const handleGenerate = async () => {
    if (images.length === 0) return
    setStep('generating')
    setError(null)
    try {
      const res = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ images, description: description || undefined }),
      })
      if (!res.ok) {
        const json = await res.json() as { error: string }
        throw new Error(json.error)
      }
      const { html } = await res.json() as { html: string }
      const slideCount = [...html.matchAll(/class="slide(?:\s|")/g)].length || 1
      setTemplateHtml(html)
      setSchema(autoDetectSchema(html))
      setSlides(Array.from({ length: slideCount }, (_, i) => ({ index: i, slots: {} })))
      setPreviewSlideIndex(0)
      setStep('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('upload')
    }
  }

  const handleSlotClick = useCallback(
    ({ slotId }: { slotId: string; currentValue: string }) => {
      setActiveSlot(schema.slots.find(s => s.id === slotId) ?? null)
    },
    [schema.slots]
  )

  const handleSlotChange = useCallback(
    (value: string) => {
      if (!activeSlot) return
      const slotId = activeSlot.id
      setSlides(prev => [{ ...prev[0], slots: { ...prev[0].slots, [slotId]: value } }])
      previewRef.current?.sendUpdate(slotId, value)
    },
    [activeSlot]
  )

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Template name is required')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('name', templateName.trim())
      formData.append('title', templateName.trim())
      formData.append('scope', 'user')
      formData.append(
        'owner',
        (pb.authStore.model as { id?: string } | null)?.id ?? ''
      )
      formData.append('schema_json', JSON.stringify(schema))
      formData.append('canvas_width', '1080')
      formData.append('canvas_height', '1350')
      formData.append('slide_count_default', '5')

      const slug = templateName.trim().replace(/\s+/g, '-').toLowerCase()
      const htmlBlob = new Blob([templateHtml], { type: 'text/html' })
      formData.append('html_file', htmlBlob, `${slug}.html`)

      // Capture thumbnail — optional, do not fail save if it errors
      try {
        const dataUrl = await requestCapture()
        if (dataUrl) {
          const thumbnailRes = await fetch(dataUrl)
          const thumbnailBlob = await thumbnailRes.blob()
          formData.append('thumbnail', thumbnailBlob, 'thumbnail.png')
        }
      } catch {
        // Proceed without thumbnail
      }

      await pb.collection('templates').create(formData)
      router.push('/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const srcdoc = templateHtml ? buildSrcdoc(templateHtml, schema, slides, previewSlideIndex) : ''

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-lg font-semibold">
          {step === 'upload' ? 'Create Template from PNG' : 'Customise Your Template'}
        </h1>
        {step === 'editing' && (
          <div className="flex items-center gap-3">
            <Input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Template name…"
              className="w-48 bg-zinc-900 border-zinc-700 h-8 text-sm"
            />
            <Button
              onClick={handleSave}
              disabled={isSaving || !templateName.trim()}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSaving ? 'Saving…' : 'Save to My Templates'}
            </Button>
          </div>
        )}
      </header>

      {error && (
        <div className="shrink-0 bg-red-900/40 border-b border-red-800 px-6 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg space-y-6">
            <div>
              <Label className="text-sm text-zinc-300 mb-2 block">
                Reference screenshots <span className="text-zinc-500">(1–3 PNG or JPG)</span>
              </Label>
              <PngUploader onImagesChange={setImages} maxFiles={3} />
            </div>
            <div>
              <Label className="text-sm text-zinc-300 mb-2 block">
                Style notes <span className="text-zinc-600">(optional)</span>
              </Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. dark background, bold sans-serif headlines, orange accent colour…"
                className="bg-zinc-900 border-zinc-700 text-white text-sm resize-none"
                rows={3}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={images.length === 0}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              Generate Template
            </Button>
          </div>
        </div>
      )}
      {step === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Generating template from your references…</p>
          <p className="text-zinc-600 text-xs">This may take 15–30 seconds</p>
        </div>
      )}
      {step === 'editing' && (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 p-8 gap-4 overflow-hidden">
            <SlidePreview
              ref={previewRef}
              srcdoc={srcdoc}
              canvasWidth={1080}
              canvasHeight={1350}
              scale={0.45}
              onSlotClick={handleSlotClick}
              onCaptureResult={handleCaptureResult}
            />
            {slides.length > 1 && (
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <button
                  type="button"
                  disabled={previewSlideIndex === 0}
                  onClick={() => {
                    const next = previewSlideIndex - 1
                    setPreviewSlideIndex(next)
                    previewRef.current?.switchSlide(next)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ←
                </button>
                <span>Slide {previewSlideIndex + 1} / {slides.length}</span>
                <button
                  type="button"
                  disabled={previewSlideIndex === slides.length - 1}
                  onClick={() => {
                    const next = previewSlideIndex + 1
                    setPreviewSlideIndex(next)
                    previewRef.current?.switchSlide(next)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </div>

          <div className="w-80 border-l border-zinc-800 flex flex-col overflow-hidden shrink-0">
            <SidePanelTabs
              activeTab={panelTab}
              onTabChange={setPanelTab}
              editContent={
                <PropertyPanel
                  activeSlot={activeSlot}
                  currentValue={
                    activeSlot
                      ? (slides[0].slots[activeSlot.id] ?? activeSlot.default ?? '')
                      : ''
                  }
                  onChange={handleSlotChange}
                />
              }
              schemaContent={
                <SchemaEditor
                  schema={schema}
                  templateHtml={templateHtml}
                  onSchemaChange={setSchema}
                />
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
