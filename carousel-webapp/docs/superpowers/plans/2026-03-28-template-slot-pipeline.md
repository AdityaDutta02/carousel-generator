# Template Slot Pipeline — Rebuild Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three interconnected bugs so generated copy correctly fills all slides, the preview switches slides without iframe reload, and export captures every slide.

**Architecture:** Remove positional slot pre-fill and instead let the `fillSlots` AI distribute copy to the correct template slots by slide number. Inject ALL slides' values in one `buildSrcdoc` pass and add a `SWITCH_SLIDE` postMessage so the builder changes slides without reloading the iframe.

**Tech Stack:** TypeScript, Next.js App Router, PocketBase, iframe+postMessage bridge, dom-to-image-more

---

## Root Causes (READ BEFORE IMPLEMENTING)

1. **Wrong slot IDs for slides 2+** (`generate/page.tsx`): `handleTemplateSelected` uses `perSlideTextSlots[0]` (which is `s1_tag_left`) as the headline slot for EVERY slide. Slides 2+ get stored with `s1_*` keys but `injectSlotValues` looks for `s2_*`, `s3_*` etc. → blank.

2. **Preview always shows slide 1** (`lib/template-engine.ts` + `builder/[id]/page.tsx`): `buildSrcdoc` only injects values for the active slide index, but the template HTML always has `.active` on the first `.slide`. Switching slides just reloads the iframe with different injected values—still showing slide 1.

3. **Export captures slide 1 every time** (`hooks/useExport.ts`): Because switching `activeSlideIndex` triggers a srcdoc rebuild + iframe reload, the `.slide.active` is always slide 1. `dom-to-image` captures slide 1 regardless of which thumbnail was selected.

4. **Slide count mismatch**: The template's `slideCountDefault` (8) may be overriding `copy.slides.length` (5) somewhere, or `slideSlots` generates entries only for slides defined in the schema (8 template slides) not for generated slides (5).

---

## File Map

| File | Change |
|------|--------|
| `lib/template-engine.ts` | Add `injectAllSlotValues`, `activateSlide`; update `buildSrcdoc` signature; add `SWITCH_SLIDE` to bridge |
| `app/(app)/generate/page.tsx` | Replace positional pre-fill with AI-driven slot distribution from `fillSlots` |
| `app/(app)/builder/[id]/page.tsx` | `srcdoc` no longer depends on `activeSlideIndex`; add `switchSlide` method to preview handle |
| `components/editor/SlidePreview.tsx` | Expose `switchSlide(index)` on the ref handle |
| `hooks/useExport.ts` | Use `previewRef.current.switchSlide(i)` instead of `onSwitchSlide` callback |
| `lib/template-engine.test.ts` | Tests for `injectAllSlotValues`, `activateSlide`, `buildSrcdoc` |

---

## Task 1: Fix `template-engine.ts` — inject all slides + activate correct slide

**Files:**
- Modify: `lib/template-engine.ts`
- Modify (tests): `lib/template-engine.test.ts`

- [ ] **Step 1.1: Write failing tests for `injectAllSlotValues` and `activateSlide`**

Open `lib/template-engine.test.ts` and add (after existing tests):

```typescript
// ── injectAllSlotValues ──────────────────────────────────────────────────
describe('injectAllSlotValues', () => {
  const MULTI_SLIDE_HTML = `<html><head></head><body>
<div class="slide active"><span data-slot="s1_headline">PH1</span></div>
<div class="slide"><span data-slot="s2_headline">PH2</span></div>
<div class="slide"><span data-slot="s3_headline">PH3</span></div>
</body></html>`

  const SCHEMA: SchemaJson = {
    version: 1,
    slots: [
      { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'S1 Headline' },
      { id: 's2_headline', slide: 2, selector: "[data-slot='s2_headline']", type: 'text', label: 'S2 Headline' },
      { id: 's3_headline', slide: 3, selector: "[data-slot='s3_headline']", type: 'text', label: 'S3 Headline' },
    ],
  }

  const SLIDES: Slide[] = [
    { index: 0, slots: { s1_headline: 'Hello Slide 1' } },
    { index: 1, slots: { s2_headline: 'Hello Slide 2' } },
    { index: 2, slots: { s3_headline: 'Hello Slide 3' } },
  ]

  it('injects values for all slides in one pass', () => {
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, SLIDES)
    expect(result).toContain('Hello Slide 1')
    expect(result).toContain('Hello Slide 2')
    expect(result).toContain('Hello Slide 3')
  })

  it('does not leave placeholder text for filled slots', () => {
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, SLIDES)
    expect(result).not.toContain('PH1')
    expect(result).not.toContain('PH2')
    expect(result).not.toContain('PH3')
  })

  it('leaves placeholder when slide has no slot value', () => {
    const sparseSlides: Slide[] = [
      { index: 0, slots: {} },
      { index: 1, slots: {} },
      { index: 2, slots: {} },
    ]
    const result = injectAllSlotValues(MULTI_SLIDE_HTML, SCHEMA, sparseSlides)
    // injectSlotValues skips empty values, so placeholders remain
    expect(result).toContain('PH1')
  })
})

// ── activateSlide ────────────────────────────────────────────────────────
describe('activateSlide', () => {
  const HTML = `<html><body>
<div class="slide active">SLIDE1</div>
<div class="slide">SLIDE2</div>
<div class="slide">SLIDE3</div>
</body></html>`

  it('moves active class to the specified slide index', () => {
    const result = activateSlide(HTML, 1)
    const matches = [...result.matchAll(/class="slide(?: active)?"/g)]
    expect(matches[0][0]).toBe('class="slide"')
    expect(matches[1][0]).toBe('class="slide active"')
    expect(matches[2][0]).toBe('class="slide"')
  })

  it('keeps slide 0 active when index is 0', () => {
    const result = activateSlide(HTML, 0)
    const matches = [...result.matchAll(/class="slide(?: active)?"/g)]
    expect(matches[0][0]).toBe('class="slide active"')
  })

  it('returns html unchanged when slideIndex is out of range', () => {
    const result = activateSlide(HTML, 99)
    expect(result).toBe(HTML)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd /Users/aditya/Documents/Coding\ Projects/Carousel\ Generator/.worktrees/carousel-webapp/carousel-webapp
npx vitest run lib/template-engine.test.ts 2>&1 | tail -20
```

Expected: FAIL — `injectAllSlotValues is not a function`, `activateSlide is not a function`

- [ ] **Step 1.3: Implement `injectAllSlotValues` and `activateSlide` in `lib/template-engine.ts`**

Add these two functions AFTER `injectSlotValues` (keep existing function — it's still used internally):

```typescript
/**
 * Injects slot values for ALL slides in a single pass.
 * Each slide's slots have unique IDs (s1_*, s2_*, etc.) so this is safe.
 */
export function injectAllSlotValues(
  html: string,
  schema: SchemaJson,
  slides: Slide[]
): string {
  let result = html
  const cssVarOverrides: string[] = []

  // Global slots (slide: 'all') — apply value from slide 0 (all slides share same value)
  for (const slot of getGlobalSlots(schema)) {
    const value = slides[0] ? resolveSlotValue(slot, slides[0]) : ''
    if (!value) continue
    if (slot.type === 'css_var' && slot.variable) {
      cssVarOverrides.push(`  ${slot.variable}: ${sanitizeCssVar(value)};`)
    }
  }

  // Per-slide slots — each slide has uniquely named slots
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const slideNumber = i + 1
    const slotsForThisSlide = getSlideSlots(schema, slideNumber)

    for (const slot of slotsForThisSlide) {
      const value = resolveSlotValue(slot, slide)
      if (!value) continue

      if (slot.type === 'text') {
        const escapedId = slot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        result = result.replace(
          new RegExp(`(<[^>]+data-slot="${escapedId}"[^>]*>)[\\s\\S]*?(</[^>]+>)`, 'g'),
          `$1${escapeHtml(value)}$2`
        )
      } else if (slot.type === 'font_size') {
        const safeSize = sanitizeFontSize(value)
        result = result.replace(
          new RegExp(`(<[^>]+data-slot-size="${slot.id}"[^>]*style=")([^"]*)(")`,'g'),
          `$1$2 font-size: ${safeSize};$3`
        )
      }
    }
  }

  if (cssVarOverrides.length > 0) {
    const styleBlock = `<style id="__slot-vars">:root {\n${cssVarOverrides.join('\n')}\n}</style>`
    result = result.replace('</head>', `${styleBlock}\n</head>`)
  }

  return result
}

/**
 * Sets the .active class on the nth .slide element (0-indexed) in the HTML string.
 * Removes .active from all other slides. Returns html unchanged if index out of range.
 */
export function activateSlide(html: string, slideIndex: number): string {
  // Collect all .slide class occurrences (handles "slide active", "slide", etc.)
  const slidePattern = /class="([^"]*\bslide\b[^"]*)"/g
  const matches = [...html.matchAll(slidePattern)]

  if (slideIndex >= matches.length || slideIndex < 0) return html

  let result = html
  // Process in reverse so string offsets stay valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const currentClasses = match[1]
    const withoutActive = currentClasses
      .split(/\s+/)
      .filter(c => c !== 'active')
      .join(' ')
      .trim()
    const newClasses = i === slideIndex ? `${withoutActive} active`.trim() : withoutActive
    const start = match.index!
    const end = start + match[0].length
    result = result.slice(0, start) + `class="${newClasses}"` + result.slice(end)
  }

  return result
}
```

- [ ] **Step 1.4: Update `buildSrcdoc` to use `injectAllSlotValues` + `activateSlide`**

Replace the existing `buildSrcdoc` function:

```typescript
export function buildSrcdoc(
  templateHtml: string,
  schema: SchemaJson,
  slides: Slide[],
  activeSlideIndex: number,
  options: BuildSrcdocOptions = {},
): string {
  const { canvasWidth = 1080, canvasHeight = 1350 } = options
  const sized = injectCanvasSize(templateHtml, canvasWidth, canvasHeight)
  const withAllValues = injectAllSlotValues(sized, schema, slides)
  const withActiveSlide = activateSlide(withAllValues, activeSlideIndex)
  return injectBridgeScript(withActiveSlide, schema)
}
```

- [ ] **Step 1.5: Add `SWITCH_SLIDE` handler to `injectBridgeScript`**

In the bridge script inside `injectBridgeScript`, add a new message handler block after the `UPDATE_SLOT` block:

```typescript
// Inside the window.addEventListener('message', ...) handler, add after the CAPTURE block:
    if (e.data.type === 'SWITCH_SLIDE') {
      var allSlides = document.querySelectorAll('.slide');
      allSlides.forEach(function(s, idx) {
        if (idx === e.data.index) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    }
```

- [ ] **Step 1.6: Run tests**

```bash
npx vitest run lib/template-engine.test.ts 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 1.7: Commit**

```bash
git add lib/template-engine.ts lib/template-engine.test.ts
git commit -m "feat(engine): inject all slides in one pass + activateSlide + SWITCH_SLIDE bridge"
```

---

## Task 2: Fix `SlidePreview` — expose `switchSlide` on the handle

**Files:**
- Modify: `components/editor/SlidePreview.tsx`

- [ ] **Step 2.1: Add `switchSlide` to `SlidePreviewHandle` and implementation**

Open `components/editor/SlidePreview.tsx`. Change:

```typescript
// OLD interface
export interface SlidePreviewHandle {
  capture: () => void
  sendUpdate: (slotId: string, value: string) => void
}
```

```typescript
// NEW interface
export interface SlidePreviewHandle {
  capture: () => void
  sendUpdate: (slotId: string, value: string) => void
  switchSlide: (index: number) => void
}
```

In `useImperativeHandle`, add the `switchSlide` entry:

```typescript
useImperativeHandle(ref, () => ({
  capture: () => sendMessage({ type: 'CAPTURE' }),
  sendUpdate: (slotId: string, value: string) =>
    sendMessage({ type: 'UPDATE_SLOT', slotId, value }),
  switchSlide: (index: number) =>
    sendMessage({ type: 'SWITCH_SLIDE', index }),
}))
```

- [ ] **Step 2.2: Verify the build compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no new errors

- [ ] **Step 2.3: Commit**

```bash
git add components/editor/SlidePreview.tsx
git commit -m "feat(preview): expose switchSlide on SlidePreviewHandle"
```

---

## Task 3: Fix `BuilderPage` — srcdoc doesn't depend on activeSlideIndex

**Files:**
- Modify: `app/(app)/builder/[id]/page.tsx`

The problem: `srcdoc` is recomputed on every `activeSlideIndex` change because it's inline in render. We need `srcdoc` to depend only on `[templateHtml, schema, carousel.slides, canvasWidth, canvasHeight]`. Slide switching uses `previewRef.current.switchSlide(i)` instead.

- [ ] **Step 3.1: Update srcdoc computation and slide-switch handler**

In `app/(app)/builder/[id]/page.tsx`, make these changes:

**a) Change the `srcdoc` variable** — pass `activeSlideIndex: 0` as the initial value (srcdoc is built once, bridge handles switching):

```typescript
// BEFORE:
const srcdoc = templateHtml && schema && carousel.slides.length > 0
  ? buildSrcdoc(templateHtml, schema, carousel.slides, activeSlideIndex,
      { canvasWidth: activeCanvasWidth, canvasHeight: activeCanvasHeight })
  : `<html>...`
```

```typescript
// AFTER:
const srcdoc = templateHtml && schema && carousel.slides.length > 0
  ? buildSrcdoc(templateHtml, schema, carousel.slides, 0,
      { canvasWidth: activeCanvasWidth, canvasHeight: activeCanvasHeight })
  : `<html><body style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-family:sans-serif"><p>Select a template to start</p></body></html>`
```

**b) Add a `useEffect` to send `SWITCH_SLIDE` when `activeSlideIndex` changes:**

Add this after the existing `useEffect` for `getCaptureWindow().__captureResolve = null`:

```typescript
useEffect(() => {
  previewRef.current?.switchSlide(activeSlideIndex)
}, [activeSlideIndex])
```

**c) Fix `handleExport` in the same file** — use `switchSlide` not `setActiveSlideIndex`:

```typescript
// BEFORE:
async function handleExport(): Promise<void> {
  await exportZip(previewRef, async (index) => {
    setActiveSlideIndex(index)
    await new Promise(r => setTimeout(r, 400))
  })
  ...
}
```

```typescript
// AFTER:
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
```

- [ ] **Step 3.2: Verify build**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no errors

- [ ] **Step 3.3: Commit**

```bash
git add app/\(app\)/builder/\[id\]/page.tsx
git commit -m "fix(builder): srcdoc built once; slide switch via postMessage not iframe reload"
```

---

## Task 4: Fix `generate/page.tsx` — AI fills all slots, distribute to correct slides

**Files:**
- Modify: `app/(app)/generate/page.tsx`
- Test: `app/(app)/generate/page.test.ts` (create)

The `fillSlots` AI already knows how to map generated copy to all template slots. We just need to distribute the flat `{slotId: value}` map to the correct per-slide `slideSlots[]` entries, then pass to `createCarousel`.

- [ ] **Step 4.1: Write the test file**

Create `app/(app)/generate/page.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { SlotDefinition } from '@/types/template'

// Pure helper extracted from handleTemplateSelected for testability
function distributeFilledSlots(
  filled: Record<string, string>,
  allSlots: SlotDefinition[],
  slideCount: number
): Record<string, string>[] {
  const slideSlots: Record<string, string>[] = Array.from({ length: slideCount }, () => ({}))
  for (const [id, val] of Object.entries(filled)) {
    if (!val) continue
    const slotDef = allSlots.find(s => s.id === id)
    if (!slotDef) continue
    if (slotDef.slide === 'all') {
      for (const slots of slideSlots) slots[id] = val
    } else {
      const idx = (slotDef.slide as number) - 1
      if (idx >= 0 && idx < slideSlots.length) slideSlots[idx][id] = val
    }
  }
  return slideSlots
}

describe('distributeFilledSlots', () => {
  const SLOTS: SlotDefinition[] = [
    { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent' },
    { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'S1 Headline' },
    { id: 's2_body', slide: 2, selector: "[data-slot='s2_body']", type: 'text', label: 'S2 Body' },
    { id: 's3_body', slide: 3, selector: "[data-slot='s3_body']", type: 'text', label: 'S3 Body' },
  ]

  it('puts global slots into every slide', () => {
    const filled = { accent: '#FF0000', s1_headline: 'Hello', s2_body: 'World' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result[0]['accent']).toBe('#FF0000')
    expect(result[1]['accent']).toBe('#FF0000')
  })

  it('puts per-slide slots into the correct slide index', () => {
    const filled = { s1_headline: 'H1', s2_body: 'B2' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result[0]['s1_headline']).toBe('H1')
    expect(result[0]['s2_body']).toBeUndefined()
    expect(result[1]['s2_body']).toBe('B2')
    expect(result[1]['s1_headline']).toBeUndefined()
  })

  it('ignores slots beyond slideCount', () => {
    const filled = { s3_body: 'Should be ignored' }
    const result = distributeFilledSlots(filled, SLOTS, 2)
    expect(result).toHaveLength(2)
    expect(result[0]['s3_body']).toBeUndefined()
    expect(result[1]['s3_body']).toBeUndefined()
  })

  it('ignores empty values', () => {
    const filled = { s1_headline: '' }
    const result = distributeFilledSlots(filled, SLOTS, 1)
    expect(result[0]['s1_headline']).toBeUndefined()
  })
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
npx vitest run app/\(app\)/generate/page.test.ts 2>&1 | tail -10
```

Expected: FAIL — `distributeFilledSlots is not defined`

- [ ] **Step 4.3: Extract `distributeFilledSlots` to `lib/slot-distribution.ts`**

Create `lib/slot-distribution.ts`:

```typescript
import type { SlotDefinition } from '@/types/template'

/**
 * Distributes a flat AI-filled slot map to per-slide slot records.
 * Global slots (slide: 'all') go into every slide.
 * Per-slide slots (slide: N) go into slideSlots[N-1].
 * Slots beyond slideCount are ignored.
 */
export function distributeFilledSlots(
  filled: Record<string, string>,
  allSlots: SlotDefinition[],
  slideCount: number
): Record<string, string>[] {
  const slideSlots: Record<string, string>[] = Array.from({ length: slideCount }, () => ({}))

  for (const [id, val] of Object.entries(filled)) {
    if (!val) continue
    const slotDef = allSlots.find(s => s.id === id)
    if (!slotDef) continue

    if (slotDef.slide === 'all') {
      for (const slots of slideSlots) slots[id] = val
    } else {
      const idx = (slotDef.slide as number) - 1
      if (idx >= 0 && idx < slideSlots.length) slideSlots[idx][id] = val
    }
  }

  return slideSlots
}
```

- [ ] **Step 4.4: Update the test import and re-run**

Update the import in `app/(app)/generate/page.test.ts`:

```typescript
import { distributeFilledSlots } from '@/lib/slot-distribution'
// Remove the local function definition
```

```bash
npx vitest run app/\(app\)/generate/page.test.ts 2>&1 | tail -10
```

Expected: all PASS

- [ ] **Step 4.5: Rewrite `handleTemplateSelected` in `generate/page.tsx`**

Replace the entire `handleTemplateSelected` function body:

```typescript
async function handleTemplateSelected(template: Template) {
  if (!copy || !user) return
  setIsCreating(true)
  try {
    const allSlots = template.schemaJson?.slots ?? []
    const slideCount = copy.slides.length

    // Let the AI map all generated copy to the correct template slots.
    // fillSlots returns a flat {slotId: value} map covering all slides.
    let filled: Record<string, string> = {}
    if (allSlots.length > 0) {
      try {
        const res = await fetch('/api/ai/fill-slots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pb.authStore.token}`,
          },
          body: JSON.stringify({ slots: allSlots, copy }),
        })
        if (res.ok) {
          filled = (await res.json()) as Record<string, string>
        } else {
          console.warn('[fill-slots] non-ok response', res.status)
        }
      } catch (err) {
        console.warn('[fill-slots] failed, slides will use placeholder text', err)
      }
    }

    // Distribute flat slot map to per-slide records
    const slideSlots = distributeFilledSlots(filled, allSlots, slideCount)

    const carousel = await createCarousel({
      owner: user.id,
      title: copy.hook,
      templateId: template.id,
      platform,
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      slideCount,
      slides: slideSlots.map((slots, i) => ({ index: i, slots })),
      status: 'draft',
    })
    router.push(`/builder/${carousel.id}`)
  } catch (err) {
    console.error('[handleTemplateSelected] failed', err)
  } finally {
    setIsCreating(false)
  }
}
```

Add the import at the top of the file:

```typescript
import { distributeFilledSlots } from '@/lib/slot-distribution'
```

Also remove the now-unused imports: `perSlideTextSlots`, `globalTextSlots`, `headlineSlot`, `bodySlot` variables and the `slideCount` state (it was `const [slideCount, setSlideCount] = useState(7)` — now uses `copy.slides.length` directly).

- [ ] **Step 4.6: Verify build compiles**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no errors

- [ ] **Step 4.7: Run all tests**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 4.8: Commit**

```bash
git add lib/slot-distribution.ts app/\(app\)/generate/page.tsx app/\(app\)/generate/page.test.ts
git commit -m "feat(generate): use AI slot distribution instead of positional pre-fill"
```

---

## Task 5: Fix slide count — `SlideThumbnails` shows correct count

**Files:**
- Modify: `app/(app)/builder/[id]/page.tsx` (minor)

The `SlideThumbnails` receives `carousel.slideCount`. This should equal `copy.slides.length` after Task 4. But the template HTML always has more `.slide` elements than the carousel's slide count (e.g., template has 8 slides, carousel has 5). The iframe should only allow navigating slides 0..slideCount-1.

- [ ] **Step 5.1: Verify the count is correct after Task 4**

After Task 4, `createCarousel({ slideCount: copy.slides.length })` should persist the right count. The `SlideThumbnails` renders `carousel.slideCount` thumbnails and sends the correct index to `setActiveSlideIndex`. The `SWITCH_SLIDE` message switches to that index in the DOM. This is correct as long as the template has at least that many `.slide` elements.

No code change needed here if Task 4 is correct. **Confirm** by manually testing: generate 5 slides, check that the builder shows 5 thumbnails.

If `carousel.slideCount` is still wrong (e.g., shows 8), check that `getCarousel` is returning the right value from PocketBase. Add a log temporarily:

```typescript
// In useCarousel useEffect, after loading:
console.log('[useCarousel] loaded', carousel.slideCount, 'slides')
```

- [ ] **Step 5.2: Commit if any fix was needed**

```bash
git add app/\(app\)/builder/\[id\]/page.tsx
git commit -m "fix(builder): correct slide count from carousel not template default"
```

---

## Task 6: Fix export — use `switchSlide` not srcdoc rebuild

Task 3 already fixes `handleExport` to call `previewRef.current?.switchSlide(index)` instead of `setActiveSlideIndex`. This task verifies the export works end-to-end.

**Files:**
- Verify: `hooks/useExport.ts`

- [ ] **Step 6.1: Check that `useExport` `exportZip` still works with new interface**

`useExport.exportZip` takes `(previewRef, onSwitchSlide)` where `onSwitchSlide(i)` is the caller-provided callback. `BuilderPage.handleExport` now passes:

```typescript
async (index) => {
  previewRef.current?.switchSlide(index)
  await new Promise(r => setTimeout(r, 150))
}
```

This is backward-compatible — `useExport` doesn't need to change. The 150ms wait is enough because `SWITCH_SLIDE` is synchronous DOM manipulation (no iframe reload).

- [ ] **Step 6.2: Verify the export includes slide 0**

The existing export loop: `for (let i = 0; i < slideCount; i++)` starts at 0. With `switchSlide(0)` as the first call, and the bridge already having slide 0 active, the 150ms wait should capture slide 0 correctly.

No code change needed. Verify by manual export test: generate carousel, export ZIP, confirm `slide-01.png` is present and correct.

- [ ] **Step 6.3: Commit (only if changes were made)**

```bash
git commit -m "fix(export): verified slide switching via postMessage, no iframe reload"
```

---

## Verification Checklist

Before marking complete, manually verify:

- [ ] Generate 5 slides → TemplatePicker → builder shows 5 thumbnails (not 8)
- [ ] Slide 1 preview shows correct filled content
- [ ] Click slide 2 thumbnail → preview updates immediately (no flash/reload) showing slide 2 content
- [ ] Click slide 3 thumbnail → shows slide 3 content
- [ ] Edit slot in property panel → live update visible in preview
- [ ] Export ZIP → 5 PNGs, each showing correct slide content
- [ ] Canvas resize → all slides still show correct content

---

## Notes

- The `fillSlots` AI prompt (`buildSlotFillPrompt`) already tells the AI to fill all slots for all slides. No prompt change needed.
- The `activateSlide` regex matches `class="..."` attributes containing the word `slide`. If a template uses different class names or inline styles for showing/hiding slides, a fallback is needed — but all four current templates use `.slide.active` convention.
- The `distributeFilledSlots` function ignores slots beyond `slideCount`, so a 5-slide carousel won't get slide 6-8 template content (which would show as placeholder in the HTML anyway since those carousel.slides entries don't exist).
- PocketBase autocancellation fix (`requestKey: \`carousel-${id}\``) was already applied — no change needed here.
