'use client'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { use } from 'react'
import { useCarousel } from '@/hooks/useCarousel'
import { useTemplateSchema } from '@/hooks/useTemplateSchema'
import { useExport } from '@/hooks/useExport'
import { buildSrcdoc } from '@/lib/template-engine'
import { SlidePreview, type SlidePreviewHandle } from '@/components/editor/SlidePreview'
import { PropertyPanel } from '@/components/editor/PropertyPanel'
import { SlideThumbnails } from '@/components/editor/SlideThumbnails'
import { CanvasSizePicker } from '@/components/editor/CanvasSizePicker'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SlotDefinition, Template } from '@/types/template'
import { CANVAS_SIZES } from '@/types/carousel'
import { updateCarousel } from '@/lib/pocketbase'
import { BrandPrompt } from '@/components/BrandPrompt'
import { useBrandProfile } from '@/hooks/useBrandProfile'

// Typed accessor for the window-level capture-resolve bridge used by useExport.
interface WindowWithCapture extends Window {
  __captureResolve: ((dataUrl: string | null) => void) | null
}
function getCaptureWindow(): WindowWithCapture {
  return window as unknown as WindowWithCapture
}
export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { carousel, isLoading, updateSlot, updateGlobalSlot, setCarousel } = useCarousel(id)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<SlotDefinition | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [canvasSizeKeyOverride, setCanvasSizeKeyOverride] = useState<string | null>(null)
  const canvasSizeKey = canvasSizeKeyOverride
    ?? (carousel
      ? (Object.entries(CANVAS_SIZES).find(
          ([, size]) => size.width === carousel.canvasWidth && size.height === carousel.canvasHeight
        )?.[0] ?? 'instagram-portrait')
      : 'instagram-portrait')
  const previewRef = useRef<SlidePreviewHandle>(null)
  const hasMountedRef = useRef(false)
  const templateId = carousel?.templateId ?? ''
  const { template, schema, templateHtml } = useTemplateSchema(templateId)

  const { isExporting, progress, exportZip } = useExport(
    carousel?.slideCount ?? 0,
    carousel?.title ?? ''
  )
  const { isFilled } = useBrandProfile()
  const [showBrandPrompt, setShowBrandPrompt] = useState(false)

  useEffect(() => {
    getCaptureWindow().__captureResolve = null
  }, [])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    previewRef.current?.switchSlide(activeSlideIndex)
  }, [activeSlideIndex])

  const handleSlotClick = useCallback(({ slotId }: { slotId: string; currentValue: string }) => {
    if (!schema) return
    const slotDef = schema.slots.find(s => s.id === slotId) ?? null
    setActiveSlot(slotDef)
  }, [schema])

  const handleCaptureResult = useCallback((dataUrl: string | null) => {
    const captureWindow = getCaptureWindow()
    if (captureWindow.__captureResolve) {
      captureWindow.__captureResolve(dataUrl)
    }
  }, [])

  const handlePropertyChange = useCallback((value: string) => {
    if (!activeSlot || !carousel) return
    if (activeSlot.slide === 'all') {
      updateGlobalSlot(activeSlot.id, value)
    } else {
      updateSlot(activeSlideIndex, activeSlot.id, value)
    }
    previewRef.current?.sendUpdate(activeSlot.id, value)
  }, [activeSlot, carousel, activeSlideIndex, updateSlot, updateGlobalSlot])

  async function handleSelectTemplate(t: Template) {
    if (!carousel) return
    const updated = await updateCarousel(carousel.id, { ...carousel, templateId: t.id })
    setCarousel(updated)
    setShowTemplatePicker(false)
  }

  async function handleExport(): Promise<void> {
    await exportZip(previewRef, async (index) => {
      previewRef.current?.switchSlide(index)
      await new Promise(r => setTimeout(r, 150))
    })
    const dismissed = localStorage.getItem('brand_prompt_dismissed') === 'true'
    if (!isFilled && !dismissed) {
      setShowBrandPrompt(true)
    }
  }

  if (isLoading || !carousel) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[675px] w-[540px]" />
      </div>
    )
  }

  const currentSlide = carousel.slides[activeSlideIndex]
  const currentSlotValue = activeSlot && currentSlide
    ? currentSlide.slots[activeSlot.id] ?? activeSlot.default ?? ''
    : ''

  const activeCanvasWidth = CANVAS_SIZES[canvasSizeKey as keyof typeof CANVAS_SIZES]?.width ?? 1080
  const activeCanvasHeight = CANVAS_SIZES[canvasSizeKey as keyof typeof CANVAS_SIZES]?.height ?? 1350
  const srcdoc = useMemo(() => {
    if (!templateHtml || !schema || carousel.slides.length === 0) {
      return `<html><body style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-family:sans-serif"><p>Select a template to start</p></body></html>`
    }
    return buildSrcdoc(templateHtml, schema, carousel.slides, 0,
      { canvasWidth: activeCanvasWidth, canvasHeight: activeCanvasHeight })
  }, [templateHtml, schema, carousel.slides, activeCanvasWidth, activeCanvasHeight])

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-6 overflow-auto">
        <SlideThumbnails
          slideCount={carousel.slideCount}
          activeIndex={activeSlideIndex}
          onSelect={setActiveSlideIndex}
        />
        <CanvasSizePicker selected={canvasSizeKey} onSelect={setCanvasSizeKeyOverride} />
        <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(true)}>
          Change Template
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 gap-6 p-8">
        <SlidePreview
          ref={previewRef}
          srcdoc={srcdoc}
          canvasWidth={activeCanvasWidth}
          canvasHeight={activeCanvasHeight}
          onSlotClick={handleSlotClick}
          onCaptureResult={handleCaptureResult}
        />
        <Button
          onClick={handleExport}
          disabled={isExporting || !template}
          className="w-48"
        >
          {isExporting ? `Exporting… ${progress}%` : 'Export ZIP'}
        </Button>
      </div>

      <PropertyPanel
        activeSlot={activeSlot}
        currentValue={currentSlotValue}
        onChange={handlePropertyChange}
      />

      {showTemplatePicker && (
        <div className="absolute inset-0 bg-zinc-950/90 z-50 flex flex-col p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Choose a Template</h2>
            <Button variant="ghost" onClick={() => setShowTemplatePicker(false)}>&#x2715; Cancel</Button>
          </div>
          <TemplatePicker onSelect={handleSelectTemplate} selectedId={templateId} />
        </div>
      )}

      {showBrandPrompt && (
        <BrandPrompt onDismiss={() => setShowBrandPrompt(false)} />
      )}
    </div>
  )
}
