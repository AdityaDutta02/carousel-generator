# Carousel Webapp — Plan 2: Template System + Editor + Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the template engine (slot injection into HTML, schema parsing), the iframe-based slide editor with click→property panel bridge, the template gallery + picker, canvas size configuration, and the one-click ZIP export.

**Architecture:** Templates are HTML files fetched from PocketBase, proxied through a Next.js route to stay same-origin. Each slide is rendered in an iframe using `srcdoc`. A bridge script injected at load time forwards click events via `postMessage`. The property panel renders controls from `schema_json`. Export captures each slide via dom-to-image-more inside the iframe, collects data URLs, and bundles them with JSZip.

**Tech Stack:** Next.js 16, dom-to-image-more, JSZip, react-colorful, PocketBase JS SDK, Vitest

**Prerequisite:** Plan 1 must be complete. PocketBase `templates` collection must exist with the fields defined in Plan 1's Task 3 setup notes.

---

## File Map

```
carousel-webapp/
├── app/
│   └── (app)/
│       ├── builder/[id]/page.tsx         Carousel builder: preview + panel
│       ├── templates/page.tsx            Template gallery
│       └── templates/new/page.tsx        Upload PNGs → AI template gen (Plan 3)
├── app/api/
│   └── template/[id]/route.ts           Proxy: serves template HTML same-origin
├── lib/
│   └── template-engine.ts               Slot injection, schema parsing, bridge protocol
├── hooks/
│   └── useTemplateSchema.ts             Load schema, resolve slot values for current carousel
├── hooks/
│   └── useExport.ts                     dom-to-image + JSZip pipeline
└── components/
    ├── editor/
    │   ├── SlidePreview.tsx             iframe wrapper + postMessage listener
    │   ├── PropertyPanel.tsx            Slot controls: text/color/font_size/toggle
    │   ├── SlideThumbnails.tsx          Clickable slide nav strip
    │   └── CanvasSizePicker.tsx         Checklist of canvas presets
    └── templates/
        ├── TemplateCard.tsx
        └── TemplatePicker.tsx
```

---

## Task 1: Template Engine

**Files:**
- Create: `carousel-webapp/lib/template-engine.ts`
- Create: `carousel-webapp/lib/template-engine.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// carousel-webapp/lib/template-engine.test.ts
import { describe, it, expect } from 'vitest'
import {
  injectSlotValues,
  injectBridgeScript,
  resolveSlotValue,
  getGlobalSlots,
  getSlideSlots,
} from './template-engine'
import type { SchemaJson } from '@/types/template'
import type { Slide } from '@/types/carousel'

const schema: SchemaJson = {
  version: 1,
  slots: [
    { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
    { id: 'accent_color', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent', default: '#E05828' },
  ],
}

const slide: Slide = {
  index: 0,
  slots: { s1_headline: 'Hello World', accent_color: '#FF0000' },
}

describe('injectSlotValues', () => {
  it('replaces data-slot text content', () => {
    const html = `<div data-slot="s1_headline">placeholder</div>`
    const result = injectSlotValues(html, schema, [slide], 0)
    expect(result).toContain('Hello World')
    expect(result).not.toContain('placeholder')
  })

  it('injects css var as style tag', () => {
    const html = `<html><head></head><body></body></html>`
    const result = injectSlotValues(html, schema, [slide], 0)
    expect(result).toContain('--accent')
    expect(result).toContain('#FF0000')
  })
})

describe('injectBridgeScript', () => {
  it('adds a script tag', () => {
    const html = `<html><head></head><body></body></html>`
    const result = injectBridgeScript(html, schema)
    expect(result).toContain('<script')
    expect(result).toContain('postMessage')
    expect(result).toContain('SLOT_CLICK')
  })
})

describe('getGlobalSlots', () => {
  it('returns only slots with slide === all', () => {
    const result = getGlobalSlots(schema)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('accent_color')
  })
})

describe('getSlideSlots', () => {
  it('returns slots for a specific slide number', () => {
    const result = getSlideSlots(schema, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1_headline')
  })
})

describe('resolveSlotValue', () => {
  it('returns slot value from slide', () => {
    expect(resolveSlotValue(schema.slots[0], slide)).toBe('Hello World')
  })

  it('returns default when slot has no value', () => {
    const emptySlide: Slide = { index: 0, slots: {} }
    expect(resolveSlotValue(schema.slots[1], emptySlide)).toBe('#E05828')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run lib/template-engine.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/lib/template-engine.ts`**

```typescript
import type { SchemaJson, SlotDefinition } from '@/types/template'
import type { Slide } from '@/types/carousel'

// ── Slot value resolution ──────────────────────────────────────────────────

export function resolveSlotValue(slot: SlotDefinition, slide: Slide): string {
  return slide.slots[slot.id] ?? slot.default ?? ''
}

export function getGlobalSlots(schema: SchemaJson): SlotDefinition[] {
  return schema.slots.filter(s => s.slide === 'all')
}

export function getSlideSlots(schema: SchemaJson, slideNumber: number): SlotDefinition[] {
  return schema.slots.filter(s => s.slide === slideNumber)
}

// ── HTML injection ─────────────────────────────────────────────────────────

/**
 * Inject slot values into template HTML for a specific slide index (0-based).
 * Slide number for schema matching is index + 1.
 */
export function injectSlotValues(
  html: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number
): string {
  const slide = slides[slideIndex]
  if (!slide) return html

  const slideNumber = slideIndex + 1
  const applicableSlots = [
    ...getGlobalSlots(schema),
    ...getSlideSlots(schema, slideNumber),
  ]

  let result = html

  // Collect CSS var overrides
  const cssVarOverrides: string[] = []
  for (const slot of applicableSlots) {
    const value = resolveSlotValue(slot, slide)
    if (!value) continue

    if (slot.type === 'text') {
      // Replace content of matching data-slot element
      const escapedId = slot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(
        new RegExp(`(<[^>]+data-slot="${escapedId}"[^>]*>)[^<]*(</[^>]+>)`, 'g'),
        `$1${escapeHtml(value)}$2`
      )
    } else if (slot.type === 'css_var' && slot.variable) {
      cssVarOverrides.push(`  ${slot.variable}: ${value};`)
    } else if (slot.type === 'font_size') {
      result = result.replace(
        new RegExp(`(<[^>]+data-slot-size="${slot.id}"[^>]*style=")([^"]*)(")`,'g'),
        `$1$2 font-size: ${value}px;$3`
      )
    }
  }

  // Inject CSS var overrides as a style block before </head>
  if (cssVarOverrides.length > 0) {
    const styleBlock = `<style id="__slot-vars">:root {\n${cssVarOverrides.join('\n')}\n}</style>`
    result = result.replace('</head>', `${styleBlock}\n</head>`)
  }

  return result
}

// ── Bridge script injection ────────────────────────────────────────────────

/**
 * Inject the editor bridge script into the template HTML.
 * This script enables click→postMessage and UPDATE_SLOT→DOM application.
 */
export function injectBridgeScript(html: string, schema: SchemaJson): string {
  const schemaJson = JSON.stringify(schema)

  const script = `
<script id="__editor-bridge">
(function() {
  var schema = ${schemaJson};

  function applyUpdate(slotId, value) {
    var slot = schema.slots.find(function(s) { return s.id === slotId; });
    if (!slot) return;
    if (slot.type === 'text') {
      var el = document.querySelector(slot.selector);
      if (el) el.textContent = value;
    } else if (slot.type === 'css_var' && slot.variable) {
      document.documentElement.style.setProperty(slot.variable, value);
    } else if (slot.type === 'font_size') {
      var els = document.querySelectorAll('[data-slot-size="' + slotId + '"]');
      els.forEach(function(el) { el.style.fontSize = value + 'px'; });
    } else if (slot.type === 'toggle') {
      var el = document.querySelector(slot.selector);
      if (el) el.style.display = value === 'true' ? '' : 'none';
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'UPDATE_SLOT') {
      applyUpdate(e.data.slotId, e.data.value);
    }
    if (e.data.type === 'CAPTURE') {
      // dom-to-image-more must be loaded in the template or injected below
      var slideEl = document.querySelector('.slide.active') || document.querySelector('.slide');
      if (!slideEl) { window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*'); return; }
      // Reset transform for accurate capture
      var origTransform = slideEl.style.transform;
      var origTransformOrigin = slideEl.style.transformOrigin;
      slideEl.style.transform = 'none';
      slideEl.style.transformOrigin = 'top left';
      domtoimage.toPng(slideEl, { width: slideEl.offsetWidth, height: slideEl.offsetHeight, style: { transform: 'none' } })
        .then(function(dataUrl) {
          slideEl.style.transform = origTransform;
          slideEl.style.transformOrigin = origTransformOrigin;
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: dataUrl }, '*');
        })
        .catch(function(err) {
          console.error('Capture failed', err);
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*');
        });
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-slot]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var slotId = el.getAttribute('data-slot');
        var rect = el.getBoundingClientRect();
        window.parent.postMessage({
          type: 'SLOT_CLICK',
          slotId: slotId,
          currentValue: el.textContent || el.getAttribute('data-value') || '',
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        }, '*');
      });
    });
  });
})();
</script>`

  // Inject dom-to-image-more from CDN and bridge script before </body>
  const domToImageScript = `<script src="https://cdn.jsdelivr.net/npm/dom-to-image-more@3/dist/dom-to-image-more.min.js"></script>`
  return html.replace('</body>', `${domToImageScript}${script}\n</body>`)
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build full srcdoc HTML for a slide: inject values + bridge script.
 */
export function buildSrcdoc(
  templateHtml: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number
): string {
  const withValues = injectSlotValues(templateHtml, schema, slides, slideIndex)
  return injectBridgeScript(withValues, schema)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/template-engine.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/template-engine.ts lib/template-engine.test.ts
git commit -m "feat: add template engine (slot injection, schema parsing, bridge script)"
```

---

## Task 2: Template Proxy API Route

**Files:**
- Create: `carousel-webapp/app/api/template/[id]/route.ts`

- [ ] **Step 1: Create `carousel-webapp/app/api/template/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import PocketBase from 'pocketbase'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090')

  try {
    const template = await pb.collection('templates').getOne(id)
    const fileUrl = pb.files.getURL(template, template.html_file as string)
    const res = await fetch(fileUrl)
    const html = await res.text()

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new NextResponse('Template not found', { status: 404 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/template/
git commit -m "feat: add template proxy route for same-origin iframe loading"
```

---

## Task 3: useTemplateSchema Hook

**Files:**
- Create: `carousel-webapp/hooks/useTemplateSchema.ts`
- Create: `carousel-webapp/hooks/useTemplateSchema.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/hooks/useTemplateSchema.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTemplateSchema } from './useTemplateSchema'

vi.mock('pocketbase', () => ({
  default: vi.fn(() => ({
    collection: vi.fn(() => ({
      getOne: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'Editorial',
        scope: 'system',
        owner: null,
        schema_json: {
          version: 1,
          slots: [
            { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
          ],
        },
        canvas_width: 1080,
        canvas_height: 1350,
        slide_count_default: 8,
        platform_tags: ['linkedin'],
        html_file: 'template.html',
        thumbnail: '',
      }),
    })),
    files: { getURL: vi.fn(() => 'http://test/template.html') },
  })),
}))

describe('useTemplateSchema', () => {
  it('loads template schema', async () => {
    const { result } = renderHook(() => useTemplateSchema('t1'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.template?.id).toBe('t1')
    expect(result.current.schema?.slots).toHaveLength(1)
  })

  it('returns null when no templateId', () => {
    const { result } = renderHook(() => useTemplateSchema(''))
    expect(result.current.template).toBeNull()
    expect(result.current.schema).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run hooks/useTemplateSchema.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/hooks/useTemplateSchema.ts`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import type { Template, SchemaJson } from '@/types/template'

export function useTemplateSchema(templateId: string) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [schema, setSchema] = useState<SchemaJson | null>(null)
  const [templateHtml, setTemplateHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!templateId) return
    setIsLoading(true)
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
          canvasWidth: record.canvas_width as number,
          canvasHeight: record.canvas_height as number,
          platformTags: (record.platform_tags as string[]) ?? [],
          slideCountDefault: record.slide_count_default as number,
        }
        setTemplate(t)
        setSchema(t.schemaJson)
        // Fetch the HTML via the same-origin proxy
        return fetch(`/api/template/${templateId}`)
      })
      .then(res => res?.text())
      .then(html => { if (html) setTemplateHtml(html) })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [templateId])

  return { template, schema, templateHtml, isLoading }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run hooks/useTemplateSchema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add hooks/useTemplateSchema.ts hooks/useTemplateSchema.test.ts
git commit -m "feat: add useTemplateSchema hook"
```

---

## Task 4: SlidePreview Component (iframe + postMessage bridge)

**Files:**
- Create: `carousel-webapp/components/editor/SlidePreview.tsx`
- Create: `carousel-webapp/components/editor/SlidePreview.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/components/editor/SlidePreview.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from './SlidePreview'

describe('SlidePreview', () => {
  it('renders an iframe', () => {
    render(
      <SlidePreview
        srcdoc="<html><body>test</body></html>"
        canvasWidth={1080}
        canvasHeight={1350}
        onSlotClick={vi.fn()}
        onCaptureResult={vi.fn()}
      />
    )
    expect(screen.getByTitle('slide-preview')).toBeInTheDocument()
  })

  it('scales iframe to fit container', () => {
    const { container } = render(
      <SlidePreview
        srcdoc="<html><body></body></html>"
        canvasWidth={1080}
        canvasHeight={1350}
        onSlotClick={vi.fn()}
        onCaptureResult={vi.fn()}
      />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run components/editor/SlidePreview.test.tsx
```

- [ ] **Step 3: Create `carousel-webapp/components/editor/SlidePreview.tsx`**

```typescript
'use client'
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

interface SlotClickEvent {
  slotId: string
  currentValue: string
}

interface SlidePreviewProps {
  srcdoc: string
  canvasWidth: number
  canvasHeight: number
  onSlotClick: (event: SlotClickEvent) => void
  onCaptureResult: (dataUrl: string | null) => void
  scale?: number
}

export interface SlidePreviewHandle {
  capture: () => void
  sendUpdate: (slotId: string, value: string) => void
}

export const SlidePreview = forwardRef<SlidePreviewHandle, SlidePreviewProps>(
  function SlidePreview(
    { srcdoc, canvasWidth, canvasHeight, onSlotClick, onCaptureResult, scale = 0.5 },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const sendMessage = useCallback((msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(msg, '*')
    }, [])

    useImperativeHandle(ref, () => ({
      capture: () => sendMessage({ type: 'CAPTURE' }),
      sendUpdate: (slotId: string, value: string) =>
        sendMessage({ type: 'UPDATE_SLOT', slotId, value }),
    }))

    useEffect(() => {
      function handleMessage(e: MessageEvent) {
        if (!e.data || typeof e.data !== 'object') return
        if (e.data.type === 'SLOT_CLICK') {
          onSlotClick({ slotId: e.data.slotId, currentValue: e.data.currentValue })
        }
        if (e.data.type === 'CAPTURE_RESULT') {
          onCaptureResult(e.data.dataUrl ?? null)
        }
      }
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }, [onSlotClick, onCaptureResult])

    const displayWidth = canvasWidth * scale
    const displayHeight = canvasHeight * scale

    return (
      <div
        className="relative overflow-hidden rounded-xl shadow-2xl"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <iframe
          ref={iframeRef}
          title="slide-preview"
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-same-origin"
          className="absolute top-0 left-0 border-0"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    )
  }
)
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run components/editor/SlidePreview.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/editor/SlidePreview.tsx components/editor/SlidePreview.test.tsx
git commit -m "feat: add SlidePreview iframe component with postMessage bridge"
```

---

## Task 5: PropertyPanel Component

**Files:**
- Create: `carousel-webapp/components/editor/PropertyPanel.tsx`
- Create: `carousel-webapp/components/editor/PropertyPanel.test.tsx`

- [ ] **Step 1: Install react-colorful**

```bash
npm install react-colorful
```

- [ ] **Step 2: Write the test**

```typescript
// carousel-webapp/components/editor/PropertyPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PropertyPanel } from './PropertyPanel'
import type { SlotDefinition } from '@/types/template'

const textSlot: SlotDefinition = {
  id: 's1_headline',
  slide: 1,
  selector: "[data-slot='s1_headline']",
  type: 'text',
  label: 'Headline',
  maxChars: 80,
}

describe('PropertyPanel', () => {
  it('renders nothing when no slot selected', () => {
    const { container } = render(
      <PropertyPanel activeSlot={null} currentValue="" onChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders textarea for text slot', () => {
    render(
      <PropertyPanel activeSlot={textSlot} currentValue="hello" onChange={vi.fn()} />
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('shows character count', () => {
    render(
      <PropertyPanel activeSlot={textSlot} currentValue="hello" onChange={vi.fn()} />
    )
    expect(screen.getByText(/5 \/ 80/)).toBeInTheDocument()
  })

  it('calls onChange when text changes', () => {
    const onChange = vi.fn()
    render(<PropertyPanel activeSlot={textSlot} currentValue="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } })
    expect(onChange).toHaveBeenCalledWith('new value')
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx vitest run components/editor/PropertyPanel.test.tsx
```

- [ ] **Step 4: Create `carousel-webapp/components/editor/PropertyPanel.tsx`**

```typescript
'use client'
import { HexColorPicker } from 'react-colorful'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { SlotDefinition } from '@/types/template'

interface PropertyPanelProps {
  activeSlot: SlotDefinition | null
  currentValue: string
  onChange: (value: string) => void
}

export function PropertyPanel({ activeSlot, currentValue, onChange }: PropertyPanelProps) {
  if (!activeSlot) return null

  return (
    <div className="p-4 space-y-4 border-l border-zinc-800 w-72 bg-zinc-950">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
          {activeSlot.label}
        </p>

        {activeSlot.type === 'text' && (
          <div className="space-y-1">
            <Textarea
              value={currentValue}
              onChange={e => onChange(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white text-sm resize-none"
              rows={4}
              maxLength={activeSlot.maxChars}
            />
            {activeSlot.maxChars && (
              <p className={`text-xs text-right ${
                currentValue.length > activeSlot.maxChars * 0.9
                  ? 'text-orange-400'
                  : 'text-zinc-500'
              }`}>
                {currentValue.length} / {activeSlot.maxChars}
              </p>
            )}
          </div>
        )}

        {activeSlot.type === 'css_var' && (
          <div className="space-y-3">
            <HexColorPicker color={currentValue || '#E05828'} onChange={onChange} />
            <input
              type="text"
              value={currentValue}
              onChange={e => onChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono"
              placeholder="#E05828"
            />
          </div>
        )}

        {activeSlot.type === 'font_size' && (
          <div className="space-y-2">
            <input
              type="range"
              min={activeSlot.min ?? 12}
              max={activeSlot.max ?? 200}
              value={Number(currentValue) || activeSlot.min ?? 12}
              onChange={e => onChange(e.target.value)}
              className="w-full accent-orange-500"
            />
            <p className="text-sm text-zinc-300 text-center">{currentValue || activeSlot.min}px</p>
          </div>
        )}

        {activeSlot.type === 'toggle' && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                currentValue === 'true' ? 'bg-orange-500' : 'bg-zinc-700'
              } relative`}
              onClick={() => onChange(currentValue === 'true' ? 'false' : 'true')}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                currentValue === 'true' ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </div>
            <span className="text-sm text-zinc-300">
              {currentValue === 'true' ? 'Visible' : 'Hidden'}
            </span>
          </label>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run components/editor/PropertyPanel.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/editor/PropertyPanel.tsx components/editor/PropertyPanel.test.tsx
git commit -m "feat: add PropertyPanel with text/color/font_size/toggle controls"
```

---

## Task 6: SlideThumbnails + CanvasSizePicker

**Files:**
- Create: `carousel-webapp/components/editor/SlideThumbnails.tsx`
- Create: `carousel-webapp/components/editor/CanvasSizePicker.tsx`

- [ ] **Step 1: Create `carousel-webapp/components/editor/SlideThumbnails.tsx`**

```typescript
'use client'
import { cn } from '@/lib/utils'

interface SlideThumbnailsProps {
  slideCount: number
  activeIndex: number
  onSelect: (index: number) => void
}

export function SlideThumbnails({ slideCount, activeIndex, onSelect }: SlideThumbnailsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: slideCount }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex-shrink-0 w-12 h-16 rounded border-2 flex items-center justify-center text-xs font-medium transition-colors',
            activeIndex === i
              ? 'border-orange-500 text-orange-400 bg-zinc-800'
              : 'border-zinc-700 text-zinc-500 bg-zinc-900 hover:border-zinc-500'
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `carousel-webapp/components/editor/CanvasSizePicker.tsx`**

```typescript
'use client'
import { CANVAS_SIZES } from '@/types/carousel'
import { cn } from '@/lib/utils'

interface CanvasSizePickerProps {
  selected: string
  onSelect: (key: string) => void
}

export function CanvasSizePicker({ selected, onSelect }: CanvasSizePickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400 font-medium">Canvas Size</p>
      <div className="space-y-1">
        {Object.entries(CANVAS_SIZES).map(([key, size]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected === key}
              onChange={() => onSelect(key)}
              className="accent-orange-500"
            />
            <span className={cn(
              'text-sm',
              selected === key ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
            )}>
              {size.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/editor/SlideThumbnails.tsx components/editor/CanvasSizePicker.tsx
git commit -m "feat: add SlideThumbnails and CanvasSizePicker components"
```

---

## Task 7: useExport Hook

**Files:**
- Create: `carousel-webapp/hooks/useExport.ts`
- Create: `carousel-webapp/hooks/useExport.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/hooks/useExport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildZipFilename } from './useExport'

describe('buildZipFilename', () => {
  it('slugifies the title', () => {
    expect(buildZipFilename('My Carousel Title')).toBe('my-carousel-title.zip')
  })

  it('handles special characters', () => {
    expect(buildZipFilename('Test & Demo!')).toBe('test-demo.zip')
  })

  it('falls back when title is empty', () => {
    expect(buildZipFilename('')).toBe('carousel.zip')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run hooks/useExport.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/hooks/useExport.ts`**

```typescript
'use client'
import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import type { SlidePreviewHandle } from '@/components/editor/SlidePreview'

export function buildZipFilename(title: string): string {
  if (!title.trim()) return 'carousel.zip'
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${slug}.zip`
}

export function useExport(slideCount: number, title: string) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const previewRefs = useRef<Map<number, SlidePreviewHandle>>(new Map())

  function registerSlideRef(index: number, handle: SlidePreviewHandle | null) {
    if (handle) {
      previewRefs.current.set(index, handle)
    } else {
      previewRefs.current.delete(index)
    }
  }

  const exportZip = useCallback(
    async (onSwitchSlide: (index: number) => Promise<void>) => {
      setIsExporting(true)
      setProgress(0)
      const zip = new JSZip()
      const dataUrls: string[] = []

      for (let i = 0; i < slideCount; i++) {
        // Switch to this slide
        await onSwitchSlide(i)
        // Allow iframe to re-render
        await new Promise(r => setTimeout(r, 300))

        const dataUrl = await new Promise<string | null>(resolve => {
          const handle = previewRefs.current.get(0)
          if (!handle) { resolve(null); return }

          const timeout = setTimeout(() => resolve(null), 5000)
          const origHandler = (window as any).__captureResolve
          ;(window as any).__captureResolve = (url: string | null) => {
            clearTimeout(timeout)
            ;(window as any).__captureResolve = origHandler
            resolve(url)
          }
          handle.capture()
        })

        if (dataUrl) {
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
          const padded = String(i + 1).padStart(2, '0')
          zip.file(`slide-${padded}.png`, base64, { base64: true })
        }
        setProgress(Math.round(((i + 1) / slideCount) * 100))
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildZipFilename(title)
      a.click()
      URL.revokeObjectURL(url)

      setIsExporting(false)
      setProgress(0)
    },
    [slideCount, title]
  )

  return { isExporting, progress, exportZip, registerSlideRef }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run hooks/useExport.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add hooks/useExport.ts hooks/useExport.test.ts
git commit -m "feat: add useExport hook with JSZip bundling"
```

---

## Task 8: Template Gallery

**Files:**
- Create: `carousel-webapp/components/templates/TemplateCard.tsx`
- Create: `carousel-webapp/components/templates/TemplatePicker.tsx`
- Create: `carousel-webapp/app/(app)/templates/page.tsx`

- [ ] **Step 1: Create `carousel-webapp/components/templates/TemplateCard.tsx`**

```typescript
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
```

- [ ] **Step 2: Create `carousel-webapp/components/templates/TemplatePicker.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { TemplateCard } from './TemplateCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { Template } from '@/types/template'
import type { SchemaJson } from '@/types/template'

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
      .getList(1, 50, { sort: 'scope,name' })
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
          platformTags: (r.platform_tags as string[]) ?? [],
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {templates.map(t => (
        <TemplateCard
          key={t.id}
          template={t}
          onSelect={onSelect}
          isSelected={t.id === selectedId}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `carousel-webapp/app/(app)/templates/page.tsx`**

```typescript
'use client'
import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { Button } from '@/components/ui/button'
import type { Template } from '@/types/template'

export default function TemplatesPage() {
  const router = useRouter()
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Button variant="outline" onClick={() => router.push('/templates/new')}>
          + Create from PNG
        </Button>
      </div>
      <TemplatePicker onSelect={(t: Template) => console.log('selected', t.id)} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/templates/ app/(app)/templates/
git commit -m "feat: add template gallery and picker components"
```

---

## Task 9: Builder Page (wires everything together)

**Files:**
- Create: `carousel-webapp/app/(app)/builder/[id]/page.tsx`

- [ ] **Step 1: Create `carousel-webapp/app/(app)/builder/[id]/page.tsx`**

```typescript
'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
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
import type { SlotDefinition } from '@/types/template'
import type { Template } from '@/types/template'
import { CANVAS_SIZES } from '@/types/carousel'
import { updateCarousel } from '@/lib/pocketbase'

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { carousel, isLoading, updateSlot, updateGlobalSlot, setCarousel } = useCarousel(id)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<SlotDefinition | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [canvasSizeKey, setCanvasSizeKey] = useState('instagram-portrait')
  const previewRef = useRef<SlidePreviewHandle>(null)

  const templateId = carousel?.templateId ?? ''
  const { template, schema, templateHtml } = useTemplateSchema(templateId)

  const { isExporting, progress, exportZip } = useExport(
    carousel?.slideCount ?? 0,
    carousel?.title ?? ''
  )

  // Handle capture results for export
  useEffect(() => {
    ;(window as any).__captureResolve = null
  }, [])

  const handleSlotClick = useCallback(({ slotId, currentValue }: { slotId: string; currentValue: string }) => {
    if (!schema) return
    const slotDef = schema.slots.find(s => s.id === slotId) ?? null
    setActiveSlot(slotDef)
  }, [schema])

  const handleCaptureResult = useCallback((dataUrl: string | null) => {
    if ((window as any).__captureResolve) {
      ;(window as any).__captureResolve(dataUrl)
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

  async function handleExport() {
    await exportZip(async (index) => {
      setActiveSlideIndex(index)
      await new Promise(r => setTimeout(r, 400))
    })
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

  const srcdoc = templateHtml && schema && carousel.slides.length > 0
    ? buildSrcdoc(templateHtml, schema, carousel.slides, activeSlideIndex)
    : `<html><body style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-family:sans-serif"><p>Select a template to start</p></body></html>`

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar: thumbnails + canvas size */}
      <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-6 overflow-auto">
        <SlideThumbnails
          slideCount={carousel.slideCount}
          activeIndex={activeSlideIndex}
          onSelect={setActiveSlideIndex}
        />
        <CanvasSizePicker selected={canvasSizeKey} onSelect={setCanvasSizeKey} />
        <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(true)}>
          Change Template
        </Button>
      </div>

      {/* Center: slide preview */}
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 gap-6 p-8">
        <SlidePreview
          ref={previewRef}
          srcdoc={srcdoc}
          canvasWidth={CANVAS_SIZES[canvasSizeKey]?.width ?? 1080}
          canvasHeight={CANVAS_SIZES[canvasSizeKey]?.height ?? 1350}
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

      {/* Right: property panel */}
      <PropertyPanel
        activeSlot={activeSlot}
        currentValue={currentSlotValue}
        onChange={handlePropertyChange}
      />

      {/* Template picker overlay */}
      {showTemplatePicker && (
        <div className="absolute inset-0 bg-zinc-950/90 z-50 flex flex-col p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Choose a Template</h2>
            <Button variant="ghost" onClick={() => setShowTemplatePicker(false)}>✕ Cancel</Button>
          </div>
          <TemplatePicker onSelect={handleSelectTemplate} selectedId={templateId} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Smoke test the builder manually**

```bash
npm run dev
```
1. Generate a carousel (from Plan 1's flow) — it redirects to `/builder/[id]`
2. Click "Change Template" — template picker overlay appears
3. (After seeding a template in PocketBase) select it — preview updates
4. Click a `[data-slot]` element in the preview — property panel appears on right
5. Edit text — live update in preview, autosaves after 1.5s
6. Click "Export ZIP" — downloads a zip with slide PNGs

- [ ] **Step 3: Commit**

```bash
git add app/(app)/builder/
git commit -m "feat: wire builder page with editor, thumbnails, canvas picker, and export"
```

---

## Task 10: Seed Existing Templates into PocketBase

> This task migrates the 4 existing templates from the parent project into PocketBase so the builder has something to work with.

- [ ] **Step 1: Create `carousel-webapp/scripts/seed-templates.mjs`**

```javascript
// carousel-webapp/scripts/seed-templates.mjs
// Run: node scripts/seed-templates.mjs
import PocketBase from 'pocketbase'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../')
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

const TEMPLATES = [
  {
    name: 'Editorial (Cream)',
    file: 'templates/template-1-editorial.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 8,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Cover Headline', maxChars: 80 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Data (Dark)',
    file: 'templates/template-2-data.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_stat', slide: 1, selector: "[data-slot='s1_stat']", type: 'text', label: 'Big Stat', maxChars: 20 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Card (Orange)',
    file: 'templates/template-3-card.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 6,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_statement', slide: 1, selector: "[data-slot='s1_statement']", type: 'text', label: 'Statement', maxChars: 120 },
      ],
    },
  },
  {
    name: 'Notebook (Yellow)',
    file: 'templates/template-4-notebook.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
        { id: 'bg', slide: 'all', selector: ':root', type: 'css_var', variable: '--bg', label: 'Background', default: '#C4EA58' },
      ],
    },
  },
]

const pb = new PocketBase(PB_URL)
await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)

for (const t of TEMPLATES) {
  const htmlPath = path.resolve(ROOT, t.file)
  if (!fs.existsSync(htmlPath)) {
    console.warn(`Skipping ${t.name} — file not found: ${htmlPath}`)
    continue
  }

  const htmlBlob = new Blob([fs.readFileSync(htmlPath)], { type: 'text/html' })
  const form = new FormData()
  form.append('name', t.name)
  form.append('scope', 'system')
  form.append('canvas_width', String(t.canvas_width))
  form.append('canvas_height', String(t.canvas_height))
  form.append('slide_count_default', String(t.slide_count_default))
  form.append('platform_tags', t.platform_tags.join(','))
  form.append('schema_json', JSON.stringify(t.schema_json))
  form.append('html_file', htmlBlob, path.basename(t.file))

  await pb.collection('templates').create(form)
  console.log(`✓ Seeded: ${t.name}`)
}
console.log('Done.')
```

- [ ] **Step 2: Run the seed script**

```bash
PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword node scripts/seed-templates.mjs
```
Expected: `✓ Seeded: Editorial (Cream)` × 4 templates

> **Note:** You need to add `data-slot` attributes to the existing template HTML files for the slot selectors to work. For now, the seeding uploads the templates as-is. Full slot annotation is part of Template Creation (Plan 3).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-templates.mjs
git commit -m "feat: add template seed script for existing HTML templates"
```

---

## Plan 2 Complete

At the end of Plan 2 you have:
- Template engine with slot injection and bridge script
- Same-origin iframe rendering with postMessage bridge
- Full editor: click-to-select → property panel (text/color/font_size/toggle)
- Slide thumbnail nav + canvas size picker
- Template gallery + picker
- ZIP export (dom-to-image-more inside iframe → JSZip)
- 4 existing templates seeded into PocketBase

**Next: Plan 3 — Template Creation from PNG + Admin + Brand Profile**
