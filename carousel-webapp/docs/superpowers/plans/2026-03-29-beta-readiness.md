# Beta Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all blocking bugs for beta launch: slide cropping, single-slide template multi-slide rendering, AI fill per-slide, simplify UI (remove canvas picker + slide count slider), add template delete, fix thumbnail capture, and run a security audit.

**Architecture:** The core rendering bug is that `buildSrcdoc` in the builder always uses `slideIndex=0` and the srcdoc memo never re-renders when the active slide changes. For single-slide templates (auto-detected by counting `.slide` elements), each carousel slide must rebuild the srcdoc with that specific slide's slot values rather than sending a `SWITCH_SLIDE` bridge message (which does nothing when there's only one slide element). The AI fill step must also call `/api/ai/fill-slots` once per carousel slide for single-slide templates so each slide gets unique content.

**Tech Stack:** Next.js 15 App Router, PocketBase, TypeScript, TailwindCSS, shadcn/ui

---

## Root Cause Map

| Symptom | Root Cause | Fix Location |
|---------|-----------|--------------|
| Bottom of slide cropped | Body has margin/stacking layout; `.slide` pushed down by preceding nodes | `lib/template-engine.ts` `injectCanvasSize` |
| All carousel slides identical | `buildSrcdoc` hardcoded `slideIndex=0`; single-slide template has one `.slide` element so `SWITCH_SLIDE` is a no-op | `app/(app)/builder/[id]/page.tsx` |
| Slides 2-8 empty in export | Export calls `switchSlide` (bridge msg) which does nothing for single-slide; no srcdoc rebuild | `app/(app)/builder/[id]/page.tsx` + `hooks/useExport.ts` |
| Slides 2-8 have no AI content | `distributeFilledSlots` puts all slot values in `slideSlots[0]` only; `fillSlots` called once with full copy | `app/(app)/generate/page.tsx` |
| 8 slides even with 5 generated | Unrelated after simplification; always 8 now | `components/generate/CopyChat.tsx` + `app/(app)/generate/page.tsx` |
| Canvas picker clutters UI | Feature not needed for beta | `app/(app)/builder/[id]/page.tsx` |
| Slide count slider clutters UI | Feature not needed for beta | `components/generate/CopyChat.tsx` |
| No delete for user templates | `TemplatePicker` / `TemplateCard` have no delete button/API | `components/templates/TemplatePicker.tsx`, `components/templates/TemplateCard.tsx`, `lib/pocketbase.ts` |
| No thumbnail for new templates | Race: fonts not loaded when `dom-to-image-more` captures; missing `document.fonts.ready` await | `lib/template-engine.ts` `injectBridgeScript` |

## File Map

| File | Changes |
|------|---------|
| `lib/template-engine.ts` | Better cropping fix (absolute position + margin:0); add `document.fonts.ready` in CAPTURE handler |
| `app/(app)/builder/[id]/page.tsx` | Add `activeSlideIndex` to srcdoc memo deps; detect single-slide; per-slide render; remove `CanvasSizePicker`; fix export for single-slide |
| `app/(app)/generate/page.tsx` | Detect single-slide template; parallel per-slide `fillSlots` calls; hardcode 8 slides |
| `components/generate/CopyChat.tsx` | Remove `Slider` entirely; remove `slideCount` state; always pass `slideCount=8` |
| `components/templates/TemplatePicker.tsx` | Pass `onDelete` prop; add delete button UI for user-scoped templates |
| `components/templates/TemplateCard.tsx` | Accept + render optional delete button |
| `lib/pocketbase.ts` | Add `deleteTemplate(id)` function |
| `hooks/useExport.ts` | No change needed (caller controls `onSwitchSlide`) |
| `types/carousel.ts` | Remove unused `CANVAS_SIZES` entries (keep 1080×1350 only) — low priority, skip for now |

---

## Task 1: Fix Slide Cropping

The body must have `margin:0; position:relative` and `.slide` must be `position:absolute; top:0; left:0` so it's always anchored to the top-left corner regardless of any preceding DOM nodes or whitespace.

**Files:**
- Modify: `lib/template-engine.ts` (function `injectCanvasSize`, line ~261)

- [ ] **Step 1: Update `injectCanvasSize` in `lib/template-engine.ts`**

Replace the existing `styleOverride` and `scriptOverride` constants inside `injectCanvasSize`:

```typescript
function injectCanvasSize(html: string, width: number, height: number): string {
  const styleOverride = `<style id="__canvas-override">
:root{--sw:${width}px;--sh:${height}px;--scale:1}
html,body{margin:0!important;padding:0!important;width:${width}px!important;height:${height}px!important;overflow:hidden!important;position:relative!important}
.viewer{width:${width}px!important;height:${height}px!important;border-radius:0!important;box-shadow:none!important;position:relative!important}
.slide{position:absolute!important;top:0!important;left:0!important;width:${width}px!important;height:${height}px!important;transform:none!important;transform-origin:top left!important}
</style>`
  // NOTE: JS in this template literal runs in the browser iframe, not Node.js.
  const scriptOverride = `<script id="__canvas-override-script">document.addEventListener('DOMContentLoaded', function() {
  var w = ${width}, h = ${height};
  // Neutralise body-level text nodes that push slide content down
  Array.from(document.body.childNodes).forEach(function(n) {
    if (n.nodeType === 3) n.textContent = '';
  });
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.position = 'relative';
  document.querySelectorAll('.viewer').forEach(function(el) {
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.borderRadius = '0';
    el.style.boxShadow = 'none';
    el.style.position = 'relative';
  });
  document.querySelectorAll('.slide').forEach(function(el) {
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.transform = 'none';
    el.style.transformOrigin = 'top left';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  });
});</script>`
  const injection = `${styleOverride}\n${scriptOverride}`
  if (html.includes('</head>')) return html.replace('</head>', `${injection}\n</head>`)
  if (html.includes('<head>')) return html.replace('<head>', `<head>${injection}`)
  return html
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/template-engine.ts
git commit -m "fix: anchor .slide to absolute top:0 left:0 to eliminate bottom cropping"
```

- [ ] **Step 3: Verify visually**

Start dev server (`npm run dev`), open `/builder/<any-id>`, confirm the bottom of the slide is no longer cropped. Navigate to different slides.

---

## Task 2: Remove Canvas Size Picker + Hardcode 1080×1350

**Files:**
- Modify: `app/(app)/builder/[id]/page.tsx`

- [ ] **Step 1: Remove `CanvasSizePicker` from builder**

In `app/(app)/builder/[id]/page.tsx`, make these changes:

Remove these imports and state:
```typescript
// DELETE these lines:
import { CanvasSizePicker } from '@/components/editor/CanvasSizePicker'
import { CANVAS_SIZES } from '@/types/carousel'

// DELETE these state variables:
const [canvasSizeKeyOverride, setCanvasSizeKeyOverride] = useState<string | null>(null)
const canvasSizeKey = canvasSizeKeyOverride
  ?? (carousel
    ? (Object.entries(CANVAS_SIZES).find(...))?.[0] ?? 'instagram-portrait')
  : 'instagram-portrait')
```

Replace `activeCanvasWidth`/`activeCanvasHeight` calculations (remove the `CANVAS_SIZES` lookup):
```typescript
// REPLACE the two lines that read from CANVAS_SIZES:
const activeCanvasWidth = 1080
const activeCanvasHeight = 1350
```

Remove the `<CanvasSizePicker>` JSX (inside the left sidebar div, around line 140):
```typescript
// DELETE this element:
<CanvasSizePicker selected={canvasSizeKey} onSelect={setCanvasSizeKeyOverride} />
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/builder/[id]/page.tsx"
git commit -m "feat: remove canvas size picker, hardcode 1080x1350"
```

---

## Task 3: Remove Slide Count Slider + Hardcode 8 Slides

**Files:**
- Modify: `components/generate/CopyChat.tsx`
- Modify: `app/(app)/generate/page.tsx`

- [ ] **Step 1: Remove slider from `CopyChat.tsx`**

In `components/generate/CopyChat.tsx`:

1. Remove `slideCount` state: `const [slideCount, setSlideCount] = useState(5)`
2. Remove the `Slider` import: `import { Slider } from '@/components/ui/slider'`
3. Replace the slider JSX block (the entire `<div className="flex gap-3 items-center">...</div>`) with nothing
4. Change the `sendMessage` call body: replace `slideCount` with the literal `8`:
   - In the `fetch` call body: `body: JSON.stringify({ messages: newMessages, userContext, slideCount: 8 })`

After changes, the relevant section in the `return` JSX should look like:
```tsx
{isFirstMessage && (
  <div className="space-y-2">
    <div className="flex gap-2 flex-wrap">
      <span className="text-sm text-zinc-400 self-center">Platform:</span>
      {PLATFORMS.map(p => (
        <Badge
          key={p.value}
          variant={platform === p.value ? 'default' : 'outline'}
          className="cursor-pointer select-none"
          onClick={() => setPlatform(p.value)}
          data-testid={`platform-badge-${p.value}`}
        >
          {p.label}
        </Badge>
      ))}
    </div>
  </div>
)}
```

And the fetch body:
```typescript
body: JSON.stringify({ messages: newMessages, userContext, slideCount: 8 }),
```

- [ ] **Step 2: Update `generate/page.tsx` to always use 8 slides**

In `app/(app)/generate/page.tsx`:
```typescript
// CHANGE:
const slideCount = copy.slides.length
// TO:
const slideCount = 8
```

- [ ] **Step 3: Commit**

```bash
git add components/generate/CopyChat.tsx "app/(app)/generate/page.tsx"
git commit -m "feat: remove slide count slider, always generate 8 slides"
```

---

## Task 4: Fix Single-Slide Template Rendering in Builder

The core fix: the builder must detect single-slide templates and rebuild `srcdoc` with the active carousel slide's values whenever `activeSlideIndex` changes.

**Files:**
- Modify: `app/(app)/builder/[id]/page.tsx`
- Modify: `lib/template-engine.ts` (add single-slide helper)

- [ ] **Step 1: Add `isSingleSlideTemplate` helper to `template-engine.ts`**

Add this exported function at the bottom of `lib/template-engine.ts`:

```typescript
/**
 * Returns true when the template HTML contains exactly one .slide element.
 * Single-slide templates are used across multiple carousel slides by re-rendering
 * the same template with different slot values per slide.
 */
export function isSingleSlideTemplate(templateHtml: string): boolean {
  return (templateHtml.match(/class="slide(?:\s|")/g) ?? []).length === 1
}
```

- [ ] **Step 2: Update srcdoc memo in builder**

In `app/(app)/builder/[id]/page.tsx`, update the `srcdoc` useMemo:

```typescript
// Add isSingleSlideTemplate to imports from template-engine:
import { buildSrcdoc, isSingleSlideTemplate } from '@/lib/template-engine'

// Replace the srcdoc useMemo (currently around line 110-116):
const srcdoc = useMemo(() => {
  if (!templateHtml || !schema || !carousel || carousel.slides.length === 0) {
    return `<html><body style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-family:sans-serif"><p>Select a template to start</p></body></html>`
  }
  if (isSingleSlideTemplate(templateHtml)) {
    // For single-slide templates, rebuild with the active carousel slide's values
    const currentSlide = carousel.slides[activeSlideIndex] ?? carousel.slides[0]
    return buildSrcdoc(templateHtml, schema, [currentSlide], 0,
      { canvasWidth: activeCanvasWidth, canvasHeight: activeCanvasHeight })
  }
  return buildSrcdoc(templateHtml, schema, carousel.slides, activeSlideIndex,
    { canvasWidth: activeCanvasWidth, canvasHeight: activeCanvasHeight })
}, [templateHtml, schema, carousel, activeSlideIndex, activeCanvasWidth, activeCanvasHeight])
```

Note `activeSlideIndex` is now in the deps array.

- [ ] **Step 3: Fix export for single-slide templates in builder**

The export calls `previewRef.current?.switchSlide(index)` which sends a bridge message. For single-slide templates this does nothing. Instead, set `activeSlideIndex` (which triggers srcdoc rebuild) and wait longer for the iframe to reload.

In `app/(app)/builder/[id]/page.tsx`, update `handleExport`:

```typescript
async function handleExport(): Promise<void> {
  const singleSlide = templateHtml ? isSingleSlideTemplate(templateHtml) : false
  await exportZip(previewRef, async (index) => {
    if (singleSlide) {
      setActiveSlideIndex(index)
      // Wait for React re-render + iframe srcdoc reload + font render
      await new Promise(r => setTimeout(r, 600))
    } else {
      previewRef.current?.switchSlide(index)
      await new Promise(r => setTimeout(r, 150))
    }
  })
  const dismissed = localStorage.getItem('brand_prompt_dismissed') === 'true'
  if (!isFilled && !dismissed) {
    setShowBrandPrompt(true)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/template-engine.ts "app/(app)/builder/[id]/page.tsx"
git commit -m "fix: single-slide template renders per-slide content in builder and export"
```

---

## Task 5: Fix AI Fill for Single-Slide Templates

For single-slide templates, each carousel slide needs its own AI-filled slot values. Currently `fillSlots` is called once with the full copy and distributes only to slide 1.

**Files:**
- Modify: `app/(app)/generate/page.tsx`

- [ ] **Step 1: Update `handleTemplateSelected` in `generate/page.tsx`**

Replace the `filled`/`slideSlots` block with:

```typescript
async function handleTemplateSelected(template: Template) {
  if (!copy || !user) return
  setIsCreating(true)
  setCreateError(null)
  try {
    const allSlots = template.schemaJson?.slots ?? []
    const slideCount = 8

    // Detect single-slide templates: all slots belong to slide 1
    const singleSlide =
      allSlots.length > 0 && allSlots.every(s => s.slide === 1 || s.slide === 'all')

    let slideSlots: Record<string, string>[]

    if (singleSlide && allSlots.length > 0) {
      // Fill slots independently for each carousel slide so each gets unique content
      const copySlides = copy.slides.slice(0, slideCount)
      const results = await Promise.all(
        copySlides.map(async (slideData) => {
          const singleCopy = { hook: copy.hook, cta: copy.cta, slides: [slideData] }
          try {
            const res = await fetch('/api/ai/fill-slots', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pb.authStore.token}`,
              },
              body: JSON.stringify({ slots: allSlots, copy: singleCopy }),
            })
            if (res.ok) return (await res.json()) as Record<string, string>
            console.warn('[fill-slots] non-ok response', res.status)
            return {}
          } catch (err) {
            console.warn('[fill-slots] failed for slide', err)
            return {}
          }
        })
      )
      slideSlots = results
    } else if (allSlots.length > 0) {
      // Multi-slide template: single fill call distributes by slot.slide number
      let filled: Record<string, string> = {}
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
      slideSlots = distributeFilledSlots(filled, allSlots, slideCount)
    } else {
      slideSlots = Array.from({ length: slideCount }, () => ({}))
    }

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
    const msg = err instanceof Error ? err.message : 'Failed to create carousel'
    setCreateError(msg)
  } finally {
    setIsCreating(false)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/generate/page.tsx"
git commit -m "fix: call fillSlots per-slide for single-slide templates so all slides get unique AI content"
```

---

## Task 6: Fix Thumbnail Capture (Font-Ready Wait)

The thumbnail capture fails when Google Fonts haven't loaded yet. Add `document.fonts.ready` before calling `dom-to-image-more`.

**Files:**
- Modify: `lib/template-engine.ts` (function `injectBridgeScript`)

- [ ] **Step 1: Add `document.fonts.ready` to CAPTURE handler**

In `lib/template-engine.ts`, update the CAPTURE handler block inside `injectBridgeScript`. Find:

```javascript
    if (e.data.type === 'CAPTURE') {
      var slideEl = document.querySelector('.slide.active') || document.querySelector('.slide');
      if (!slideEl) { window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*'); return; }
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
```

Replace with:

```javascript
    if (e.data.type === 'CAPTURE') {
      var slideEl = document.querySelector('.slide.active') || document.querySelector('.slide');
      if (!slideEl) { window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*'); return; }
      var origTransform = slideEl.style.transform;
      var origTransformOrigin = slideEl.style.transformOrigin;
      slideEl.style.transform = 'none';
      slideEl.style.transformOrigin = 'top left';
      // Wait for web fonts before capturing to avoid blank/fallback text
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function() {
        return domtoimage.toPng(slideEl, { width: slideEl.offsetWidth, height: slideEl.offsetHeight, style: { transform: 'none' } });
      }).then(function(dataUrl) {
          slideEl.style.transform = origTransform;
          slideEl.style.transformOrigin = origTransformOrigin;
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: dataUrl }, '*');
        })
        .catch(function(err) {
          console.error('Capture failed', err);
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*');
        });
    }
```

- [ ] **Step 2: Commit**

```bash
git add lib/template-engine.ts
git commit -m "fix: wait for document.fonts.ready before thumbnail capture to avoid blank fonts"
```

---

## Task 7: Add Delete for User-Scoped Templates

Users need to delete templates they created. Show a delete button only for `scope: 'user'` templates.

**Files:**
- Modify: `lib/pocketbase.ts` (add `deleteTemplate`)
- Modify: `components/templates/TemplateCard.tsx` (add optional delete button)
- Modify: `components/templates/TemplatePicker.tsx` (pass `onDelete` + reload)
- Modify: `app/(app)/templates/page.tsx` (no changes needed — uses TemplatePicker which handles it)

- [ ] **Step 1: Add `deleteTemplate` to `lib/pocketbase.ts`**

Add this function after `publishTemplate`:

```typescript
export async function deleteTemplate(templateId: string): Promise<void> {
  await getPocketBase().collection('templates').delete(templateId)
}
```

- [ ] **Step 2: Read `components/templates/TemplateCard.tsx`**

Read the file to understand its current props and JSX before modifying.

- [ ] **Step 3: Update `TemplateCard` to accept an `onDelete` prop**

In `components/templates/TemplateCard.tsx`, add:

```typescript
interface TemplateCardProps {
  template: Template
  onSelect: (template: Template) => void
  isSelected?: boolean
  onDelete?: (template: Template) => void  // optional — only shown when provided
}
```

Inside the card JSX, add a delete button that appears only when `onDelete` is provided AND `template.scope === 'user'`:

```tsx
{onDelete && template.scope === 'user' && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      if (confirm(`Delete "${template.name}"?`)) onDelete(template)
    }}
    className="absolute top-2 right-2 p-1 rounded bg-zinc-800/80 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
    aria-label="Delete template"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  </button>
)}
```

The card wrapper must be `relative` positioned for `absolute` delete button placement.

- [ ] **Step 4: Update `TemplatePicker` to handle delete**

In `components/templates/TemplatePicker.tsx`:

1. Import `deleteTemplate` from `@/lib/pocketbase`
2. Add `onDelete?: (template: Template) => void` to `TemplatePickerProps`
3. Add a `handleDelete` callback:

```typescript
async function handleDelete(template: Template) {
  try {
    await deleteTemplate(template.id)
    setTemplates(prev => prev.filter(t => t.id !== template.id))
  } catch (err) {
    console.error('Failed to delete template', err)
  }
}
```

4. Pass it to `TemplateCard`:

```tsx
<TemplateCard
  key={t.id}
  template={t}
  onSelect={onSelect}
  isSelected={t.id === selectedId}
  onDelete={handleDelete}
/>
```

- [ ] **Step 5: Commit**

```bash
git add lib/pocketbase.ts components/templates/TemplateCard.tsx components/templates/TemplatePicker.tsx
git commit -m "feat: add delete button for user-scoped templates"
```

---

## Task 8: Security Audit

**Files:**
- Read all API routes, template-engine, pocketbase client code
- Modify as needed for security gaps

- [ ] **Step 1: Verify all API routes check auth**

Read each route and confirm they call `verifyToken`:
- `app/api/ai/generate-copy/route.ts` — check for `Authorization` header + `verifyToken`
- `app/api/ai/generate-template/route.ts` — check for `Authorization` header + `verifyToken`
- `app/api/ai/fill-slots/route.ts` — already confirmed ✓
- `app/api/template/[id]/route.ts` — reads template with user token (correct)

- [ ] **Step 2: Check `generate-copy/route.ts` for auth**

Read `app/api/ai/generate-copy/route.ts`. If it doesn't call `verifyToken`, add it:

```typescript
const authHeader = req.headers.get('authorization') ?? ''
const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
const user = token ? await verifyToken(token) : null
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

- [ ] **Step 3: Check `generate-template/route.ts` for auth**

Read `app/api/ai/generate-template/route.ts`. Apply same auth guard if missing.

- [ ] **Step 4: Add iframe sandbox attribute to `SlidePreview`**

Read `components/editor/SlidePreview.tsx`. The iframe renders user-controlled template HTML. Add a `sandbox` attribute to restrict it. The bridge script uses `postMessage` which works in sandboxed iframes. Google Fonts require network access.

Find the `<iframe>` element and add:
```tsx
sandbox="allow-scripts allow-same-origin"
```

Note: `allow-same-origin` is needed for `dom-to-image-more` to access resources. `allow-scripts` is needed for the bridge JS to run.

- [ ] **Step 5: Add `postMessage` origin checking to bridge**

In `lib/template-engine.ts`, the `window.addEventListener('message', ...)` handler has no origin check. In the `injectBridgeScript` function, update the message listener:

```javascript
  window.addEventListener('message', function(e) {
    // Only accept messages from the parent window
    if (e.source !== window.parent) return;
    if (!e.data || typeof e.data !== 'object') return;
```

This prevents arbitrary pages from sending control messages to the iframe.

- [ ] **Step 6: Verify `escapeHtml` is applied to all slot injections**

In `lib/template-engine.ts`, confirm `applySlotToHtml` calls `escapeHtml(value)` for text slots (it does — this prevents stored XSS).

- [ ] **Step 7: Verify no SQL/NoSQL injection in PocketBase calls**

In `lib/pocketbase.ts`, the `listCarousels` filter uses string interpolation:
```typescript
filter: `owner = "${ownerId}"`,
```

`ownerId` comes from `client.authStore.model?.id` — a PocketBase-generated ID (alphanumeric, no special chars). This is safe, but document why:

Add a comment:
```typescript
// ownerId is a PocketBase record ID (alphanumeric) from the authenticated session — safe to interpolate
filter: `owner = "${ownerId}"`,
```

- [ ] **Step 8: Commit security fixes**

```bash
git add app/api/ai/generate-copy/route.ts app/api/ai/generate-template/route.ts \
  components/editor/SlidePreview.tsx lib/template-engine.ts lib/pocketbase.ts
git commit -m "security: add iframe sandbox, origin check in bridge, verify route auth guards"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bottom cropping → Task 1
- ✅ Single-slide template all slides identical → Tasks 4 + 5
- ✅ Remove canvas size picker → Task 2
- ✅ Remove slide count slider + hardcode 8 → Task 3
- ✅ No thumbnail for user templates → Task 6
- ✅ No delete for user templates → Task 7
- ✅ Security audit → Task 8
- ✅ Export correctness for single-slide templates → Task 4 Step 3

**Placeholder scan:** None found.

**Type consistency:**
- `isSingleSlideTemplate(templateHtml: string): boolean` — consistent across Task 1 and Task 4
- `deleteTemplate(templateId: string): Promise<void>` — used in Tasks 7
- `onDelete?: (template: Template) => void` — consistent across TemplateCard and TemplatePicker
