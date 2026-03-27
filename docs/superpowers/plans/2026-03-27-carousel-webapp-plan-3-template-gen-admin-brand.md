# Carousel Webapp — Plan 3: Template Creation from PNG + Admin + Brand Profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build template creation from PNG references via AI, the schema editor tab for slot customization, admin role enforcement with system template publishing, lazy brand profile collection after first export, and the settings page.

**Architecture:** PNG images are sent as base64 data URLs to a Next.js API route, passed to a capable vision model (GOOD_MODEL) via OpenRouter, which returns a self-contained HTML template. The user edits the result in the same iframe editor from Plan 2 with a new Schema tab for defining slot metadata. Admin users publish user-scoped templates to system-wide visibility via a PocketBase update. Brand profile is collected lazily after the first export using a dismissible modal, stored on the PocketBase user record, and injected into all subsequent AI prompts.

**Tech Stack:** Next.js 16, OpenRouter GOOD_MODEL (vision-capable), react-colorful, PocketBase JS SDK, Vitest, React Testing Library

**Prerequisites:** Plans 1 and 2 must be complete. All PocketBase collections (`users`, `templates`, `carousels`) must exist with the fields from Plan 1 Task 3.

---

## File Map

```
carousel-webapp/
├── app/
│   ├── (app)/
│   │   ├── templates/new/page.tsx      CREATE — upload PNGs → generate → edit + schema → save
│   │   └── settings/page.tsx           CREATE — brand profile settings form
│   └── api/
│       └── ai/
│           └── generate-template/
│               └── route.ts            CREATE — good model template gen from base64 images
├── lib/
│   └── openrouter.ts                   MODIFY — add buildTemplateGenSystemPrompt() + generateTemplate()
├── components/
│   ├── templates/
│   │   └── PngUploader.tsx             CREATE — drag-drop PNG upload with base64 conversion
│   ├── editor/
│   │   └── SchemaEditor.tsx            CREATE — slot definition UI (add/edit/remove slots)
│   └── BrandPrompt.tsx                 CREATE — dismissible post-export brand profile modal
└── hooks/
    └── useBrandProfile.ts              CREATE — read/write brand profile from PocketBase user record
```

Existing files modified:
- `carousel-webapp/components/templates/TemplateCard.tsx` — add "Publish" button visible to admins
- `carousel-webapp/lib/pocketbase.ts` — add `publishTemplate()` helper
- `carousel-webapp/app/(app)/layout.tsx` — add Settings to sidebar nav
- `carousel-webapp/app/(app)/builder/[id]/page.tsx` — show BrandPrompt after export if profile unfilled

---

## Task 1: PngUploader Component

**Files:**
- Create: `carousel-webapp/components/templates/PngUploader.tsx`
- Create: `carousel-webapp/components/templates/PngUploader.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// carousel-webapp/components/templates/PngUploader.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PngUploader } from './PngUploader'

describe('PngUploader', () => {
  it('renders the drop zone with drag and drop text', () => {
    render(<PngUploader onImagesChange={vi.fn()} />)
    expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument()
  })

  it('shows max file count', () => {
    render(<PngUploader onImagesChange={vi.fn()} maxFiles={3} />)
    expect(screen.getByText(/up to 3/i)).toBeInTheDocument()
  })

  it('calls onImagesChange with base64 data URLs when files selected', async () => {
    const onImagesChange = vi.fn()
    render(<PngUploader onImagesChange={onImagesChange} />)

    const file = new File(['fake-png-bytes'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    // Allow FileReader async to complete
    await new Promise(r => setTimeout(r, 50))
    expect(onImagesChange).toHaveBeenCalled()
    const arg: string[] = onImagesChange.mock.calls[0][0]
    expect(arg[0]).toMatch(/^data:image\//)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run components/templates/PngUploader.test.tsx
```

Expected: FAIL with "Cannot find module './PngUploader'"

- [ ] **Step 3: Create `carousel-webapp/components/templates/PngUploader.tsx`**

```typescript
'use client'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PngUploaderProps {
  onImagesChange: (dataUrls: string[]) => void
  maxFiles?: number
  disabled?: boolean
}

export function PngUploader({ onImagesChange, maxFiles = 3, disabled = false }: PngUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const accepted = Array.from(files)
        .filter(f => f.type === 'image/png' || f.type === 'image/jpeg')
        .slice(0, maxFiles)

      const readers = accepted.map(
        file =>
          new Promise<string>(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
      )

      Promise.all(readers).then(dataUrls => {
        setPreviews(dataUrls)
        onImagesChange(dataUrls)
      })
    },
    [maxFiles, onImagesChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const removeImage = (index: number) => {
    const next = previews.filter((_, i) => i !== index)
    setPreviews(next)
    onImagesChange(next)
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-zinc-700 hover:border-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <p className="text-zinc-400 text-sm">Drag &amp; drop PNG screenshots here, or click to browse</p>
        <p className="text-zinc-600 text-xs mt-1">Up to {maxFiles} images · PNG or JPG</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={e => processFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {previews.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Reference ${i + 1}`}
                className="h-24 w-auto rounded border border-zinc-700 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run components/templates/PngUploader.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/components/templates/PngUploader.tsx \
         carousel-webapp/components/templates/PngUploader.test.tsx
git commit -m "feat(templates): add PngUploader component with drag-drop and base64 conversion"
```

---

## Task 2: Template Generation Prompt + OpenRouter Extension

**Files:**
- Modify: `carousel-webapp/lib/openrouter.ts`
- Modify: `carousel-webapp/lib/openrouter.test.ts` (add to existing file from Plan 1)

- [ ] **Step 1: Add tests to `carousel-webapp/lib/openrouter.test.ts`**

Open the file and append these describe blocks (do not delete existing tests):

```typescript
// Append to carousel-webapp/lib/openrouter.test.ts
import { buildTemplateGenSystemPrompt } from './openrouter'

describe('buildTemplateGenSystemPrompt', () => {
  it('includes canvas dimensions', () => {
    const prompt = buildTemplateGenSystemPrompt()
    expect(prompt).toContain('1080')
    expect(prompt).toContain('1350')
  })

  it('includes data-slot annotation rules', () => {
    const prompt = buildTemplateGenSystemPrompt()
    expect(prompt).toContain('data-slot')
  })

  it('includes CSS variable conventions', () => {
    const prompt = buildTemplateGenSystemPrompt()
    expect(prompt).toContain('--accent')
  })

  it('enforces HTML-only output (no markdown fences)', () => {
    const prompt = buildTemplateGenSystemPrompt()
    expect(prompt).toContain('HTML only')
  })

  it('includes a worked example with data-slot attributes', () => {
    const prompt = buildTemplateGenSystemPrompt()
    expect(prompt).toContain('WORKED EXAMPLE')
    expect(prompt).toMatch(/data-slot="s1_headline"/)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL on new tests only**

```bash
cd carousel-webapp && npx vitest run lib/openrouter.test.ts
```

Expected: existing tests PASS, new tests FAIL with "buildTemplateGenSystemPrompt is not a function"

- [ ] **Step 3: Append to `carousel-webapp/lib/openrouter.ts`**

Open the file and append everything below after the last existing export. Do not modify any existing code.

```typescript
// ─── Template Generation (GOOD_MODEL only) ────────────────────────────────────

const TEMPLATE_EXAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
:root {
  --accent: #E05828;
  --bg: #F0EDE5;
  --dark: #111110;
  --sw: 1080px;
  --sh: 1350px;
  --scale: 0.5;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { width: var(--sw); height: var(--sh); overflow: hidden; }
.slide {
  width: var(--sw);
  height: var(--sh);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: 72px;
  transform-origin: top left;
  transform: scale(var(--scale));
}
.headline {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 130px;
  font-weight: 900;
  line-height: 0.95;
  color: var(--dark);
  text-transform: uppercase;
}
.body-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 32px;
  color: var(--dark);
  margin-top: 40px;
}
.brand {
  font-family: 'DM Sans', sans-serif;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-top: auto;
}
</style>
</head>
<body>
<div class="slide">
  <h1 class="headline" data-slot="s1_headline" data-slot-size="headline">Most Investors Get This Wrong</h1>
  <p class="body-text" data-slot="s1_body">And it costs them 30% returns every year.</p>
  <p class="brand" data-slot="s1_brand">FinanceFirst</p>
</div>
</body>
</html>`

export function buildTemplateGenSystemPrompt(): string {
  return `You are an expert HTML/CSS designer specialising in social media carousel slides.

## TASK
Generate a single self-contained HTML template for a carousel slide based on the provided reference images.

## REQUIRED SPECIFICATIONS
- Canvas: exactly 1080×1350px (set on both body and .slide element)
- The .slide element must have: width: 1080px; height: 1350px; transform-origin: top left; transform: scale(0.5);
- Minimum inner padding: 72px on all sides
- Load fonts from Google Fonts only (no system fonts, no other CDNs)
- All colours must be CSS custom properties on :root (e.g., --accent, --bg, --dark, --text)
- All font sizes that should be editable must be CSS custom properties (e.g., --headline-size)

## SLOT ANNOTATION RULES
Every element whose text content should be user-editable MUST have: data-slot="unique_id"
Every element whose font size is controlled by a CSS var MUST also have: data-slot-size="slot_name"

Slot ID naming convention:
- s1_headline — slide 1 main headline
- s1_body — slide 1 body text
- s1_brand — slide 1 brand/creator name
- s1_stat — slide 1 stat or big number
- s1_caption — slide 1 small caption

## CSS VARIABLE CONVENTIONS
:root {
  --accent: #E05828;  /* primary accent colour */
  --bg: #F0EDE5;      /* slide background colour */
  --dark: #111110;    /* primary text colour */
  --sw: 1080px;
  --sh: 1350px;
  --scale: 0.5;
}

## WORKED EXAMPLE (replicate this structure exactly)
${TEMPLATE_EXAMPLE}

## OUTPUT RULES
- Output HTML only — no explanation, no markdown fences, no code block wrappers
- The entire response must be a valid complete HTML document starting with <!DOCTYPE html>
- Must be self-contained (no external JS; Google Fonts only for external resources)
- Must include at minimum: s1_headline and s1_body slots with data-slot attributes
- Match the visual style, layout, colours, and typography of the reference images as closely as possible`
}

export async function generateTemplate(images: string[], description?: string): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: GOOD_MODEL,
    messages: [
      {
        role: 'system',
        content: buildTemplateGenSystemPrompt(),
      },
      {
        role: 'user',
        content: [
          ...images.map(url => ({
            type: 'image_url' as const,
            image_url: { url },
          })),
          {
            type: 'text' as const,
            text: description
              ? `Generate a carousel template matching this style. Additional notes: ${description}`
              : 'Generate a carousel template that closely matches the visual style of these reference images.',
          },
        ],
      },
    ],
    max_tokens: 8000,
  })

  const html = response.choices[0].message.content ?? ''
  // Strip any accidental markdown fences the model may have wrapped the output in
  return html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
}
```

- [ ] **Step 4: Run all openrouter tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run lib/openrouter.test.ts
```

Expected: PASS (all tests, including new ones)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/lib/openrouter.ts carousel-webapp/lib/openrouter.test.ts
git commit -m "feat(ai): add buildTemplateGenSystemPrompt and generateTemplate for vision model"
```

---

## Task 3: Generate Template API Route

**Files:**
- Create: `carousel-webapp/app/api/ai/generate-template/route.ts`
- Create: `carousel-webapp/app/api/ai/generate-template/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// carousel-webapp/app/api/ai/generate-template/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/openrouter', () => ({
  generateTemplate: vi.fn().mockResolvedValue('<html><body><div class="slide">mock</div></body></html>'),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ai/generate-template', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/ai/generate-template', () => {
  it('returns 400 when images array is empty', async () => {
    const res = await POST(makeRequest({ images: [] }))
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toMatch(/image/i)
  })

  it('returns 400 when more than 3 images provided', async () => {
    const res = await POST(makeRequest({ images: ['a', 'b', 'c', 'd'] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when image is not a data URL', async () => {
    const res = await POST(makeRequest({ images: ['https://example.com/img.png'] }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with html on success', async () => {
    const res = await POST(makeRequest({
      images: ['data:image/png;base64,abc123'],
      description: 'dark theme',
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { html: string }
    expect(json.html).toContain('<html>')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run app/api/ai/generate-template/route.test.ts
```

Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Create `carousel-webapp/app/api/ai/generate-template/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateTemplate } from '@/lib/openrouter'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { images?: unknown; description?: unknown }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
  }

  if (body.images.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 reference images allowed' }, { status: 400 })
  }

  const images = body.images as string[]
  for (const img of images) {
    if (typeof img !== 'string' || !img.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Images must be base64 data URLs (data:image/...)' }, { status: 400 })
    }
  }

  const description = typeof body.description === 'string' ? body.description : undefined

  try {
    const html = await generateTemplate(images, description)
    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Template generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run app/api/ai/generate-template/route.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/app/api/ai/generate-template/route.ts \
         carousel-webapp/app/api/ai/generate-template/route.test.ts
git commit -m "feat(api): add /api/ai/generate-template route for PNG to HTML via vision model"
```

---

## Task 4: SchemaEditor Component

**Files:**
- Create: `carousel-webapp/components/editor/SchemaEditor.tsx`
- Create: `carousel-webapp/components/editor/SchemaEditor.test.tsx`

The SchemaEditor auto-detects `data-slot` attributes in the template HTML, lists all currently-defined slots with editable metadata, and surfaces any detected-but-undefined slots for quick addition.

- [ ] **Step 1: Write the failing tests**

```typescript
// carousel-webapp/components/editor/SchemaEditor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SchemaEditor } from './SchemaEditor'
import type { SchemaJson } from '@/types/template'

const schema: SchemaJson = {
  version: 1,
  slots: [
    {
      id: 's1_headline',
      slide: 1,
      selector: "[data-slot='s1_headline']",
      type: 'text',
      label: 'Headline',
      maxChars: 80,
    },
    {
      id: 'accent_color',
      slide: 'all',
      selector: ':root',
      type: 'css_var',
      variable: '--accent',
      label: 'Accent Color',
      default: '#E05828',
    },
  ],
}

describe('SchemaEditor', () => {
  it('renders label inputs for all defined slots', () => {
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Headline')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Accent Color')).toBeInTheDocument()
  })

  it('shows the type for each slot', () => {
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={vi.fn()} />)
    expect(screen.getAllByText('text').length).toBeGreaterThan(0)
    expect(screen.getAllByText('css_var').length).toBeGreaterThan(0)
  })

  it('calls onSchemaChange with updated label when label input changes', () => {
    const onSchemaChange = vi.fn()
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={onSchemaChange} />)
    const labelInput = screen.getByDisplayValue('Headline')
    fireEvent.change(labelInput, { target: { value: 'Cover Headline' } })
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots[0].label).toBe('Cover Headline')
  })

  it('removes a slot when Remove is clicked', () => {
    const onSchemaChange = vi.fn()
    render(<SchemaEditor schema={schema} templateHtml="" onSchemaChange={onSchemaChange} />)
    const removeButtons = screen.getAllByTitle('Remove slot')
    fireEvent.click(removeButtons[0])
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots).toHaveLength(1)
  })

  it('shows detected-but-undefined slot IDs from templateHtml', () => {
    const html = `<div data-slot="s2_headline">text</div><p data-slot="s2_body">body</p>`
    render(<SchemaEditor schema={{ version: 1, slots: [] }} templateHtml={html} onSchemaChange={vi.fn()} />)
    expect(screen.getByText('s2_headline')).toBeInTheDocument()
    expect(screen.getByText('s2_body')).toBeInTheDocument()
  })

  it('adds a detected slot when + Add is clicked', () => {
    const onSchemaChange = vi.fn()
    const html = `<div data-slot="s2_headline">text</div>`
    render(<SchemaEditor schema={{ version: 1, slots: [] }} templateHtml={html} onSchemaChange={onSchemaChange} />)
    fireEvent.click(screen.getByText('+ Add'))
    expect(onSchemaChange).toHaveBeenCalled()
    const updated: SchemaJson = onSchemaChange.mock.calls[0][0]
    expect(updated.slots[0].id).toBe('s2_headline')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd carousel-webapp && npx vitest run components/editor/SchemaEditor.test.tsx
```

Expected: FAIL with "Cannot find module './SchemaEditor'"

- [ ] **Step 3: Create `carousel-webapp/components/editor/SchemaEditor.tsx`**

```typescript
'use client'
import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SchemaJson, SlotDefinition, SlotType } from '@/types/template'

interface SchemaEditorProps {
  schema: SchemaJson
  templateHtml: string
  onSchemaChange: (schema: SchemaJson) => void
}

function detectSlotIds(html: string): string[] {
  const ids = [...html.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1])
  return [...new Set(ids)]
}

function defaultSlot(id: string): SlotDefinition {
  return {
    id,
    slide: 1,
    selector: `[data-slot='${id}']`,
    type: 'text',
    label: id.replace(/_/g, ' ').replace(/^s\d+ /, ''),
    maxChars: 80,
  }
}

export function SchemaEditor({ schema, templateHtml, onSchemaChange }: SchemaEditorProps) {
  const detectedIds = useMemo(() => detectSlotIds(templateHtml), [templateHtml])
  const definedIds = new Set(schema.slots.map(s => s.id))
  const undefinedIds = detectedIds.filter(id => !definedIds.has(id))

  const updateSlot = (index: number, updates: Partial<SlotDefinition>) => {
    const updatedSlots = schema.slots.map((slot, i) => (i === index ? { ...slot, ...updates } : slot))
    onSchemaChange({ ...schema, slots: updatedSlots })
  }

  const removeSlot = (index: number) => {
    onSchemaChange({ ...schema, slots: schema.slots.filter((_, i) => i !== index) })
  }

  const addDetected = (id: string) => {
    onSchemaChange({ ...schema, slots: [...schema.slots, defaultSlot(id)] })
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-widest">Slot Schema</p>

      {undefinedIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">Detected in HTML — not yet defined:</p>
          {undefinedIds.map(id => (
            <div key={id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
              <code className="text-xs text-orange-400">{id}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={() => addDetected(id)}
              >
                + Add
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {schema.slots.map((slot, index) => (
          <div key={slot.id} className="bg-zinc-900 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <code className="text-xs text-zinc-500">{slot.id}</code>
              <button
                type="button"
                title="Remove slot"
                onClick={() => removeSlot(index)}
                className="text-zinc-600 hover:text-red-400 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Label</Label>
                <Input
                  value={slot.label}
                  onChange={e => updateSlot(index, { label: e.target.value })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Type</Label>
                <Select
                  value={slot.type}
                  onValueChange={v => updateSlot(index, { type: v as SlotType })}
                >
                  <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">text</SelectItem>
                    <SelectItem value="css_var">css_var</SelectItem>
                    <SelectItem value="font_size">font_size</SelectItem>
                    <SelectItem value="toggle">toggle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {slot.type === 'text' && (
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Max characters</Label>
                <Input
                  type="number"
                  value={slot.maxChars ?? 80}
                  onChange={e => updateSlot(index, { maxChars: Number(e.target.value) })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700 w-24"
                  min={10}
                  max={500}
                />
              </div>
            )}

            {slot.type === 'css_var' && (
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">CSS variable name</Label>
                <Input
                  value={slot.variable ?? ''}
                  onChange={e => updateSlot(index, { variable: e.target.value })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700 font-mono"
                  placeholder="--accent"
                />
              </div>
            )}

            {slot.type === 'font_size' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Min px</Label>
                  <Input
                    type="number"
                    value={slot.min ?? 12}
                    onChange={e => updateSlot(index, { min: Number(e.target.value) })}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Max px</Label>
                  <Input
                    type="number"
                    value={slot.max ?? 200}
                    onChange={e => updateSlot(index, { max: Number(e.target.value) })}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {schema.slots.length === 0 && undefinedIds.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-4">
          No data-slot attributes found in template HTML.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run components/editor/SchemaEditor.test.tsx
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/components/editor/SchemaEditor.tsx \
         carousel-webapp/components/editor/SchemaEditor.test.tsx
git commit -m "feat(editor): add SchemaEditor for template slot metadata definition"
```

---

## Task 5: Templates New Page — Full Creation Flow

**Files:**
- Create: `carousel-webapp/app/(app)/templates/new/page.tsx`

This page is not unit-tested (full page components tested via E2E). Implements the complete flow: upload → generate → edit/schema tabs → save to PocketBase with thumbnail.

- [ ] **Step 1: Create `carousel-webapp/app/(app)/templates/new/page.tsx`**

```typescript
'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PngUploader } from '@/components/templates/PngUploader'
import { SchemaEditor } from '@/components/editor/SchemaEditor'
import { PropertyPanel } from '@/components/editor/PropertyPanel'
import { SlidePreview, type SlidePreviewHandle } from '@/components/editor/SlidePreview'
import { buildSrcdoc } from '@/lib/template-engine'
import { pb } from '@/lib/pocketbase'
import type { SchemaJson, SlotDefinition } from '@/types/template'
import type { Slide } from '@/types/carousel'

type Step = 'upload' | 'generating' | 'editing'

function autoDetectSchema(html: string): SchemaJson {
  const ids = [...new Set([...html.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]))]
  const slots: SlotDefinition[] = ids.map(id => ({
    id,
    slide: 1,
    selector: `[data-slot='${id}']`,
    type: 'text',
    label: id.replace(/_/g, ' ').replace(/^s\d+ /, ''),
    maxChars: 80,
  }))
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

  const handleGenerate = async () => {
    if (images.length === 0) return
    setStep('generating')
    setError(null)
    try {
      const res = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, description: description || undefined }),
      })
      if (!res.ok) {
        const json = await res.json() as { error: string }
        throw new Error(json.error)
      }
      const { html } = await res.json() as { html: string }
      setTemplateHtml(html)
      setSchema(autoDetectSchema(html))
      setStep('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('upload')
    }
  }

  const handleSlotClick = useCallback(
    (slotId: string) => {
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
      formData.append('scope', 'user')
      formData.append('owner', pb.authStore.model?.id ?? '')
      formData.append('schema_json', JSON.stringify(schema))
      formData.append('canvas_width', '1080')
      formData.append('canvas_height', '1350')
      formData.append('slide_count_default', '5')

      const slug = templateName.trim().replace(/\s+/g, '-').toLowerCase()
      const htmlBlob = new Blob([templateHtml], { type: 'text/html' })
      formData.append('html_file', htmlBlob, `${slug}.html`)

      // Capture thumbnail — optional, do not fail save if it errors
      try {
        const dataUrl = await previewRef.current?.capture()
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

  const srcdoc = templateHtml ? buildSrcdoc(templateHtml, schema, slides, 0) : ''

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
          <div className="flex-1 flex items-center justify-center bg-zinc-900 p-8 overflow-hidden">
            <SlidePreview
              ref={previewRef}
              srcdoc={srcdoc}
              width={1080}
              height={1350}
              scale={0.45}
              onSlotClick={handleSlotClick}
            />
          </div>

          <div className="w-80 border-l border-zinc-800 flex flex-col overflow-hidden shrink-0">
            <Tabs defaultValue="edit" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-4 grid grid-cols-2 bg-zinc-900 shrink-0">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="flex-1 overflow-y-auto mt-0">
                <PropertyPanel
                  activeSlot={activeSlot}
                  currentValue={
                    activeSlot
                      ? (slides[0].slots[activeSlot.id] ?? activeSlot.default ?? '')
                      : ''
                  }
                  onChange={handleSlotChange}
                />
              </TabsContent>
              <TabsContent value="schema" className="flex-1 overflow-y-auto mt-0">
                <SchemaEditor
                  schema={schema}
                  templateHtml={templateHtml}
                  onSchemaChange={setSchema}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the page compiles without TypeScript errors**

```bash
cd carousel-webapp && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run dev server and manually test the upload flow**

```bash
cd carousel-webapp && npm run dev
```

Navigate to `http://localhost:3000/templates/new`. Verify:
- Upload form renders with drag-drop zone
- Generate button is disabled with no images
- After selecting images, Generate button is enabled
- (With a real `OPENROUTER_API_KEY` set) clicking Generate spins and then shows the editor
- Edit tab shows PropertyPanel; Schema tab shows SchemaEditor
- Save with a name navigates to `/templates`

- [ ] **Step 4: Commit**

```bash
git add "carousel-webapp/app/(app)/templates/new/page.tsx"
git commit -m "feat(templates): add full template creation page (PNG → AI → edit + schema → save)"
```

---

## Task 6: Admin Publish Flow

**Files:**
- Modify: `carousel-webapp/lib/pocketbase.ts`
- Create: `carousel-webapp/lib/pocketbase.test.ts`
- Modify: `carousel-webapp/components/templates/TemplateCard.tsx`

This task adds a `publishTemplate()` helper and a "Publish" button on `TemplateCard` visible only to admins. It also documents the PocketBase collection rules that must be set in the admin UI.

**PocketBase collection rules** — set these in the PocketBase admin UI (`http://127.0.0.1:8090/_/`) under Collections → `templates` → API Rules:

| Rule | Value |
|---|---|
| List | _(empty — all authenticated users)_ |
| View | _(empty)_ |
| Create | `@request.auth.id != ""` |
| Update | `@request.auth.id = owner \|\| @request.auth.role = "admin"` |
| Delete | `@request.auth.id = owner \|\| @request.auth.role = "admin"` |

- [ ] **Step 1: Write the failing test**

```typescript
// carousel-webapp/lib/pocketbase.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockUpdate = vi.fn().mockResolvedValue({ id: 'tpl1', scope: 'system', owner: null })
const mockCollection = vi.fn(() => ({ update: mockUpdate }))

vi.mock('pocketbase', () => ({
  default: vi.fn(() => ({ collection: mockCollection })),
}))

// Import AFTER mock so the singleton uses the mocked PocketBase
const { publishTemplate } = await import('./pocketbase')

describe('publishTemplate', () => {
  it('calls collection(templates).update with scope=system and owner=null', async () => {
    const result = await publishTemplate('tpl1')
    expect(mockCollection).toHaveBeenCalledWith('templates')
    expect(mockUpdate).toHaveBeenCalledWith('tpl1', { scope: 'system', owner: null })
    expect(result.scope).toBe('system')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run lib/pocketbase.test.ts
```

Expected: FAIL with "publishTemplate is not a function"

- [ ] **Step 3: Append `publishTemplate` to `carousel-webapp/lib/pocketbase.ts`**

Open the file and add at the end (do not modify existing code):

```typescript
import type { Template } from '@/types/template'

export async function publishTemplate(templateId: string): Promise<Template> {
  return pb.collection('templates').update(templateId, {
    scope: 'system',
    owner: null,
  }) as Promise<Template>
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd carousel-webapp && npx vitest run lib/pocketbase.test.ts
```

Expected: PASS

- [ ] **Step 5: Replace `carousel-webapp/components/templates/TemplateCard.tsx` with the full admin-aware version**

This replaces the Plan 2 implementation with a version that adds the Publish button for admins:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { pb, publishTemplate } from '@/lib/pocketbase'
import type { Template } from '@/types/template'

interface TemplateCardProps {
  template: Template
  onSelect?: (template: Template) => void
  onPublished?: (updated: Template) => void
}

export function TemplateCard({ template, onSelect, onPublished }: TemplateCardProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const isAdmin = (pb.authStore.model as { role?: string } | null)?.role === 'admin'
  const canPublish = isAdmin && template.scope === 'user'

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

  return (
    <div
      className="group relative cursor-pointer rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors bg-zinc-900"
      onClick={() => onSelect?.(template)}
    >
      {template.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full aspect-[4/5] object-cover"
        />
      ) : (
        <div className="w-full aspect-[4/5] bg-zinc-800 flex items-center justify-center">
          <span className="text-zinc-600 text-sm">No preview</span>
        </div>
      )}

      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{template.name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-zinc-500">
            {template.scope === 'system' ? 'System' : 'My template'}
          </p>
          {template.platformTags?.length > 0 && (
            <p className="text-xs text-zinc-600">{template.platformTags.join(' · ')}</p>
          )}
        </div>
      </div>

      {canPublish && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-6 bg-zinc-900/90 border-zinc-600 hover:bg-orange-500 hover:border-orange-500 hover:text-white"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? '…' : 'Publish'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
cd carousel-webapp && npx vitest run
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add carousel-webapp/lib/pocketbase.ts \
         carousel-webapp/lib/pocketbase.test.ts \
         carousel-webapp/components/templates/TemplateCard.tsx
git commit -m "feat(admin): add publishTemplate helper and admin Publish button on TemplateCard"
```

---

## Task 7: useBrandProfile Hook

**Files:**
- Create: `carousel-webapp/hooks/useBrandProfile.ts`
- Create: `carousel-webapp/hooks/useBrandProfile.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// carousel-webapp/hooks/useBrandProfile.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockModel = {
  id: 'user1',
  brand_name: '',
  display_name: 'Aditya',
  handle: '@aditya',
  accent_color: '#E05828',
  tone: 'Professional',
  target_audience: '',
  platform_preference: 'LinkedIn',
}

const mockUpdate = vi.fn().mockResolvedValue({ ...mockModel, brand_name: 'TestBrand' })

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    authStore: {
      model: mockModel,
      onChange: vi.fn(() => () => {}),
    },
    collection: vi.fn(() => ({ update: mockUpdate })),
  },
}))

const { useBrandProfile } = await import('./useBrandProfile')

describe('useBrandProfile', () => {
  it('returns isFilled=false when brand_name is empty', () => {
    const { result } = renderHook(() => useBrandProfile())
    expect(result.current.isFilled).toBe(false)
  })

  it('exposes profile fields mapped from auth model', () => {
    const { result } = renderHook(() => useBrandProfile())
    expect(result.current.profile.displayName).toBe('Aditya')
    expect(result.current.profile.handle).toBe('@aditya')
  })

  it('calls pb.collection("users").update when save is called', async () => {
    const { result } = renderHook(() => useBrandProfile())
    await act(async () => {
      await result.current.save({ brandName: 'TestBrand' })
    })
    expect(mockUpdate).toHaveBeenCalledWith('user1', { brand_name: 'TestBrand' })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run hooks/useBrandProfile.test.ts
```

Expected: FAIL with "Cannot find module './useBrandProfile'"

- [ ] **Step 3: Create `carousel-webapp/hooks/useBrandProfile.ts`**

```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'

export interface BrandProfile {
  displayName: string
  brandName: string
  handle: string
  accentColor: string
  tone: 'Professional' | 'Casual' | 'Bold' | 'Educational'
  targetAudience: string
  platformPreference: 'LinkedIn' | 'Instagram' | 'Both'
}

type PbModel = Record<string, unknown>

function modelToProfile(model: PbModel): BrandProfile {
  return {
    displayName: (model.display_name as string) ?? '',
    brandName: (model.brand_name as string) ?? '',
    handle: (model.handle as string) ?? '',
    accentColor: (model.accent_color as string) ?? '#E05828',
    tone: (model.tone as BrandProfile['tone']) ?? 'Professional',
    targetAudience: (model.target_audience as string) ?? '',
    platformPreference:
      (model.platform_preference as BrandProfile['platformPreference']) ?? 'LinkedIn',
  }
}

const EMPTY_PROFILE: BrandProfile = {
  displayName: '',
  brandName: '',
  handle: '',
  accentColor: '#E05828',
  tone: 'Professional',
  targetAudience: '',
  platformPreference: 'LinkedIn',
}

export function useBrandProfile() {
  const [profile, setProfile] = useState<BrandProfile>(() =>
    pb.authStore.model ? modelToProfile(pb.authStore.model as PbModel) : EMPTY_PROFILE
  )
  const [isSaving, setIsSaving] = useState(false)

  const isFilled = profile.brandName.trim().length > 0

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.model) {
        setProfile(modelToProfile(pb.authStore.model as PbModel))
      }
    })
    return () => unsub()
  }, [])

  const save = useCallback(async (updates: Partial<BrandProfile>) => {
    const userId = pb.authStore.model?.id as string | undefined
    if (!userId) throw new Error('Not authenticated')

    const data: PbModel = {}
    if (updates.displayName !== undefined) data.display_name = updates.displayName
    if (updates.brandName !== undefined) data.brand_name = updates.brandName
    if (updates.handle !== undefined) data.handle = updates.handle
    if (updates.accentColor !== undefined) data.accent_color = updates.accentColor
    if (updates.tone !== undefined) data.tone = updates.tone
    if (updates.targetAudience !== undefined) data.target_audience = updates.targetAudience
    if (updates.platformPreference !== undefined) data.platform_preference = updates.platformPreference

    setIsSaving(true)
    try {
      const updated = await pb.collection('users').update(userId, data)
      setProfile(modelToProfile(updated as unknown as PbModel))
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { profile, isFilled, save, isSaving }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run hooks/useBrandProfile.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/hooks/useBrandProfile.ts \
         carousel-webapp/hooks/useBrandProfile.test.ts
git commit -m "feat(profile): add useBrandProfile hook for reading/writing brand details"
```

---

## Task 8: BrandPrompt Component

**Files:**
- Create: `carousel-webapp/components/BrandPrompt.tsx`
- Create: `carousel-webapp/components/BrandPrompt.test.tsx`

Shown as a modal overlay after the first carousel export when the brand profile is unfilled. Offers Skip, "Don't ask again", and a save form with the essential brand fields.

- [ ] **Step 1: Write the failing tests**

```typescript
// carousel-webapp/components/BrandPrompt.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockSave = vi.fn().mockResolvedValue(undefined)

vi.mock('@/hooks/useBrandProfile', () => ({
  useBrandProfile: vi.fn(() => ({
    profile: {
      displayName: '',
      brandName: '',
      handle: '',
      accentColor: '#E05828',
      tone: 'Professional',
      targetAudience: '',
      platformPreference: 'LinkedIn',
    },
    isFilled: false,
    save: mockSave,
    isSaving: false,
  })),
}))

const { BrandPrompt } = await import('./BrandPrompt')

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('BrandPrompt', () => {
  it('renders the prompt headline', () => {
    render(<BrandPrompt />)
    expect(screen.getByText(/save your brand/i)).toBeInTheDocument()
  })

  it('calls onDismiss when Skip is clicked', () => {
    const onDismiss = vi.fn()
    render(<BrandPrompt onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it("sets localStorage flag when \"Don't ask again\" is clicked", () => {
    render(<BrandPrompt />)
    fireEvent.click(screen.getByRole('button', { name: /don't ask again/i }))
    expect(localStorage.getItem('brand_prompt_dismissed')).toBe('true')
  })

  it('calls save and onDismiss when form is submitted with a brand name', async () => {
    const onDismiss = vi.fn()
    render(<BrandPrompt onDismiss={onDismiss} />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), {
      target: { value: 'FinanceFirst' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save brand/i }))
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run components/BrandPrompt.test.tsx
```

Expected: FAIL with "Cannot find module './BrandPrompt'"

- [ ] **Step 3: Create `carousel-webapp/components/BrandPrompt.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBrandProfile } from '@/hooks/useBrandProfile'

interface BrandPromptProps {
  onDismiss?: () => void
}

export function BrandPrompt({ onDismiss }: BrandPromptProps) {
  const { profile, save, isSaving } = useBrandProfile()
  const [brandName, setBrandName] = useState(profile.brandName)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [tone, setTone] = useState(profile.tone)
  const [targetAudience, setTargetAudience] = useState(profile.targetAudience)
  const [platformPreference, setPlatformPreference] = useState(profile.platformPreference)

  const handleDontAskAgain = () => {
    localStorage.setItem('brand_prompt_dismissed', 'true')
    onDismiss?.()
  }

  const handleSave = async () => {
    await save({ brandName, displayName, handle, tone, targetAudience, platformPreference })
    onDismiss?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Save your brand details</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Personalise future carousels with your brand voice and style.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Brand name *</Label>
            <Input
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="Brand name (e.g. FinanceFirst)"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Your name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Handle</Label>
            <Input
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="@handle"
              className="bg-zinc-800 border-zinc-700 text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Tone</Label>
              <Select value={tone} onValueChange={v => setTone(v as typeof tone)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Bold">Bold</SelectItem>
                  <SelectItem value="Educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Platform</Label>
              <Select
                value={platformPreference}
                onValueChange={v => setPlatformPreference(v as typeof platformPreference)}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Target audience</Label>
            <Input
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              placeholder="e.g. retail investors aged 25–40"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={() => onDismiss?.()}
            >
              Skip for now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-600 hover:text-zinc-400 text-xs"
              onClick={handleDontAskAgain}
            >
              Don't ask again
            </Button>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !brandName.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            size="sm"
          >
            {isSaving ? 'Saving…' : 'Save brand'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd carousel-webapp && npx vitest run components/BrandPrompt.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add carousel-webapp/components/BrandPrompt.tsx \
         carousel-webapp/components/BrandPrompt.test.tsx
git commit -m "feat(profile): add BrandPrompt dismissible modal for post-export brand collection"
```

---

## Task 9: Settings Page

**Files:**
- Create: `carousel-webapp/app/(app)/settings/page.tsx`
- Modify: `carousel-webapp/app/(app)/layout.tsx`

The settings page is the full-featured form for managing the brand profile, with a color picker and all fields.

- [ ] **Step 1: Create `carousel-webapp/app/(app)/settings/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HexColorPicker } from 'react-colorful'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBrandProfile } from '@/hooks/useBrandProfile'

export default function SettingsPage() {
  const { profile, save, isSaving } = useBrandProfile()
  const [brandName, setBrandName] = useState(profile.brandName)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [accentColor, setAccentColor] = useState(profile.accentColor)
  const [tone, setTone] = useState(profile.tone)
  const [targetAudience, setTargetAudience] = useState(profile.targetAudience)
  const [platformPreference, setPlatformPreference] = useState(profile.platformPreference)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await save({ brandName, displayName, handle, accentColor, tone, targetAudience, platformPreference })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-6">
      <h1 className="text-2xl font-bold text-white mb-2">Brand Profile</h1>
      <p className="text-zinc-400 text-sm mb-8">
        These details are injected into every AI prompt to personalise your carousel copy.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="brandName" className="text-sm text-zinc-300 mb-2 block">
            Brand name
          </Label>
          <Input
            id="brandName"
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="e.g. FinanceFirst"
            className="bg-zinc-900 border-zinc-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="displayName" className="text-sm text-zinc-300 mb-2 block">
            Your name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Aditya"
            className="bg-zinc-900 border-zinc-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="handle" className="text-sm text-zinc-300 mb-2 block">
            Social handle
          </Label>
          <Input
            id="handle"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="@handle"
            className="bg-zinc-900 border-zinc-700 text-white font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-zinc-300 mb-2 block">Tone</Label>
            <Select value={tone} onValueChange={v => setTone(v as typeof tone)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Bold">Bold</SelectItem>
                <SelectItem value="Educational">Educational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-zinc-300 mb-2 block">Platform</Label>
            <Select
              value={platformPreference}
              onValueChange={v => setPlatformPreference(v as typeof platformPreference)}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="targetAudience" className="text-sm text-zinc-300 mb-2 block">
            Target audience
          </Label>
          <Textarea
            id="targetAudience"
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            placeholder="e.g. retail investors aged 25–40 interested in personal finance"
            className="bg-zinc-900 border-zinc-700 text-white resize-none"
            rows={2}
          />
        </div>

        <div>
          <Label className="text-sm text-zinc-300 mb-2 block">Accent colour</Label>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-md border border-zinc-700 shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <Input
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              className="w-32 bg-zinc-900 border-zinc-700 text-white font-mono text-sm"
              placeholder="#E05828"
            />
          </div>
          <HexColorPicker color={accentColor} onChange={setAccentColor} />
        </div>

        <Button
          type="submit"
          disabled={isSaving}
          className="bg-orange-500 hover:bg-orange-600 text-white w-full"
        >
          {saved ? 'Saved!' : isSaving ? 'Saving…' : 'Save Profile'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Add Settings to sidebar nav in `carousel-webapp/app/(app)/layout.tsx`**

Open the file. Find the `navItems` array (it currently has three entries: `dashboard`, `generate`, `templates`). Add Settings as a fourth entry:

```bash
cd carousel-webapp && grep -n "href.*dashboard\|navItems" "app/(app)/layout.tsx"
```

This shows you the line. Then open the file and change the `navItems` array from:

```typescript
const navItems = [
  { href: '/dashboard', label: 'My Carousels' },
  { href: '/generate', label: 'New Carousel' },
  { href: '/templates', label: 'Templates' },
]
```

to:

```typescript
const navItems = [
  { href: '/dashboard', label: 'My Carousels' },
  { href: '/generate', label: 'New Carousel' },
  { href: '/templates', label: 'Templates' },
  { href: '/settings', label: 'Settings' },
]
```

- [ ] **Step 3: Run dev server and verify settings page**

```bash
cd carousel-webapp && npm run dev
```

Verify:
- Settings link appears in the sidebar
- Navigating to `/settings` shows the full brand profile form
- Submitting the form updates PocketBase and shows "Saved!"

- [ ] **Step 4: Commit**

```bash
git add "carousel-webapp/app/(app)/settings/page.tsx" \
        "carousel-webapp/app/(app)/layout.tsx"
git commit -m "feat(settings): add brand profile settings page and sidebar link"
```

---

## Task 10: Wire BrandPrompt After Export

**Files:**
- Modify: `carousel-webapp/app/(app)/builder/[id]/page.tsx`

After a successful ZIP export, check if the brand profile is filled. If not (and the user hasn't dismissed permanently), show the `BrandPrompt` modal.

- [ ] **Step 1: Open `carousel-webapp/app/(app)/builder/[id]/page.tsx`**

Add these two imports at the top of the file (alongside existing imports):

```typescript
import { BrandPrompt } from '@/components/BrandPrompt'
import { useBrandProfile } from '@/hooks/useBrandProfile'
```

- [ ] **Step 2: Add brand prompt state inside the component function**

Inside the component function, after existing state declarations, add:

```typescript
const { isFilled } = useBrandProfile()
const [showBrandPrompt, setShowBrandPrompt] = useState(false)
```

- [ ] **Step 3: Add export wrapper that shows the prompt on success**

In Plan 2, the export button calls `exportZip(handleSwitchSlide)` directly. Find that button's `onClick` handler and replace it with a wrapper:

Add this function inside the component (before the JSX return):

```typescript
const handleExport = async () => {
  await exportZip(handleSwitchSlide)
  const dismissed = localStorage.getItem('brand_prompt_dismissed') === 'true'
  if (!isFilled && !dismissed) {
    setShowBrandPrompt(true)
  }
}
```

Then change the export button from:
```typescript
onClick={() => exportZip(handleSwitchSlide)}
```
to:
```typescript
onClick={handleExport}
```

- [ ] **Step 4: Render the BrandPrompt at the bottom of the JSX return**

Inside the outermost `<div>` of the return statement, before the closing `</div>`, add:

```typescript
{showBrandPrompt && (
  <BrandPrompt onDismiss={() => setShowBrandPrompt(false)} />
)}
```

- [ ] **Step 5: Run all tests**

```bash
cd carousel-webapp && npx vitest run
```

Expected: PASS (all tests)

- [ ] **Step 6: Verify the full export → brand prompt flow manually**

```bash
cd carousel-webapp && npm run dev
```

1. Create a carousel through the full generate flow
2. Open it in the builder
3. Click Export ZIP
4. Confirm ZIP downloads
5. Verify the BrandPrompt modal appears (brand profile is empty on a fresh account)
6. Click "Skip for now" — modal closes, reappears on next export
7. Click "Don't ask again" — modal never appears again
8. Fill in brand name and click "Save brand" — modal closes, brand is saved in PocketBase

- [ ] **Step 7: Commit**

```bash
git add "carousel-webapp/app/(app)/builder/[id]/page.tsx"
git commit -m "feat(profile): show BrandPrompt after first export when profile is unfilled"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Covered by |
|---|---|
| Upload 1–3 PNG references | Task 1 (PngUploader) |
| Optional style description | Task 5 (templates/new page) |
| AI generates HTML/CSS (good model) | Tasks 2, 3 |
| User previews generated result | Task 5 (SlidePreview in editing step) |
| Edit in template editor (same editor) | Task 5 (PropertyPanel + Edit tab) |
| Schema tab to define/label slots | Tasks 4, 5 (SchemaEditor + Schema tab) |
| Save to My Templates | Task 5 (handleSave → PocketBase) |
| Thumbnail captured on save | Task 5 (previewRef.current.capture()) |
| Admin option: Publish to System Templates | Task 6 (publishTemplate + Publish button) |
| PocketBase collection rules for admin enforcement | Task 6 (documented + code) |
| Flow 3: lazy brand profile after first export | Tasks 7, 8, 10 |
| Brand profile dismissible prompt | Task 8 (BrandPrompt with Skip / Don't ask again) |
| Brand profile persistent storage (PocketBase users) | Task 7 (useBrandProfile.save) |
| Settings page for brand profile | Task 9 |
| Settings link in sidebar | Task 9 |

### 2. Placeholder Scan

No TBDs, TODOs, or vague instructions remain. All code blocks are complete.

### 3. Type Consistency

- `BrandProfile.tone`: `'Professional' | 'Casual' | 'Bold' | 'Educational'` — consistent in hook, prompt, settings page, BrandPrompt ✅
- `BrandProfile.platformPreference`: `'LinkedIn' | 'Instagram' | 'Both'` — consistent ✅
- `publishTemplate(id: string): Promise<Template>` — return type matches `Template` from `@/types/template` ✅
- `generateTemplate(images: string[], description?: string): Promise<string>` — used correctly in API route ✅
- `SchemaEditor` props: `{ schema: SchemaJson, templateHtml: string, onSchemaChange: (schema: SchemaJson) => void }` — consistent across tests, component, and page ✅
- `SlidePreviewHandle.capture()` — referenced from Plan 2, returns `Promise<string>` ✅
- `buildSrcdoc(html, schema, slides, index)` — imported from `@/lib/template-engine`, consistent with Plan 2 ✅
