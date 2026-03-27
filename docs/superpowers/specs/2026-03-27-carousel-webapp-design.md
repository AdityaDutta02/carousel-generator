# Carousel Generator — Web App Design Spec
**Date:** 2026-03-27
**Status:** Approved

---

## What We're Building

A multi-platform LinkedIn/Instagram carousel creation web app. Users input a topic, article, script, or writeup; an AI conversation generates viral, platform-optimised slide copy; the user picks a template; the system builds the carousel; the user edits text/colours inline; exports as a ZIP of PNGs in one click.

Secondary features: user-defined templates (generated from PNG references via AI), admin-managed system templates, a lightweight hybrid editor (click-to-select + side property panel), configurable canvas sizes and slide counts.

**Target:** Starts as a private tool, evolves into public SaaS.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | Next.js 16 App Router on Vercel (free hobby) | SSR, API routes, free hosting |
| Auth + DB + Storage | PocketBase on Fly.io (free machines tier) | Single binary, built-in auth, SQLite, file storage, admin UI |
| AI | OpenRouter (DeepSeek-V3 / Gemini Flash for most; Claude Haiku or Gemini 1.5 Pro for template gen only) | Cheap fast models for 95% of calls |
| UI | shadcn/ui + Tailwind CSS | OSS, consistent, fast to build |
| Export | dom-to-image-more + JSZip (client-side) | Zero server infra; Puppeteer upgrade path available |
| Color picker | react-colorful (~3kb) | Lightweight OSS |

**Free until 100 users:** Yes. Vercel hobby + Fly.io free machines = $0.

---

## Architecture

```
Browser (Next.js / Vercel)
  ├── App UI (shadcn/ui + Tailwind)
  ├── API routes → OpenRouter
  │     ├── DeepSeek-V3 / Gemini Flash  ← copy gen, slot fill (cheap)
  │     └── Claude Haiku / Gemini 1.5 Pro ← template gen from PNG (only this route hits a capable model)
  ├── Client-side export (dom-to-image-more + JSZip)
  └── PocketBase SDK
        └── PocketBase on Fly.io
              ├── Auth (built-in users + roles)
              ├── SQLite DB
              └── File storage (template HTML, thumbnails, logos)
```

**Puppeteer upgrade path:** When pixel-perfect exports are needed, add a Node.js + Puppeteer service on Fly.io. Swap `lib/export.ts` to call it via a single API route — no other changes required.

---

## Roles

- **user** — create and manage own carousels and templates
- **admin** — all user permissions + publish templates to system library (visible to all users)

Role stored as a field on the PocketBase user record.

---

## Data Models (PocketBase Collections)

### `users` (extends PocketBase auth)
| Field | Type | Notes |
|---|---|---|
| display_name | text | |
| brand_name | text | Collected after first export |
| handle | text | @handle |
| bio | text | |
| logo | file | |
| accent_color | text | Hex, default #E05828 |
| tone | select | Professional / Casual / Bold / Educational |
| target_audience | text | |
| platform_preference | select | LinkedIn / Instagram / Both |
| role | select | user / admin |

### `templates`
| Field | Type | Notes |
|---|---|---|
| name | text | |
| scope | select | system / user |
| owner | relation → users | null for system templates |
| html_file | file | Self-contained HTML/CSS skeleton |
| schema_json | json | Slot definitions (see below) |
| thumbnail | file | PNG preview |
| canvas_width | number | e.g. 1080 |
| canvas_height | number | e.g. 1350 |
| platform_tags | select (multi) | LinkedIn / Instagram / Stories |
| slide_count_default | number | |

### `carousels`
| Field | Type | Notes |
|---|---|---|
| owner | relation → users | |
| title | text | |
| template | relation → templates | |
| platform | select | |
| canvas_width | number | |
| canvas_height | number | |
| slide_count | number | |
| slides_json | json | Embedded array of slide slot values |
| status | select | draft / exported |

`slides_json` structure:
```json
[
  {
    "index": 0,
    "slots": {
      "s1_headline": "Most investors get this wrong",
      "s1_body": "And it costs them 30% returns every year."
    }
  }
]
```

---

## Template Schema (`schema_json`)

Describes what is editable in a template without touching the HTML structure.

```json
{
  "version": 1,
  "slots": [
    {
      "id": "s1_headline",
      "slide": 1,
      "selector": "[data-slot='s1_headline']",
      "type": "text",
      "label": "Cover Headline",
      "maxChars": 80
    },
    {
      "id": "s1_body",
      "slide": 1,
      "selector": "[data-slot='s1_body']",
      "type": "text",
      "label": "Cover Body",
      "maxChars": 120
    },
    {
      "id": "accent_color",
      "slide": "all",
      "type": "css_var",
      "variable": "--accent",
      "label": "Accent Color",
      "default": "#E05828"
    },
    {
      "id": "headline_size",
      "slide": "all",
      "type": "font_size",
      "selector": "[data-slot-size='headline']",
      "label": "Headline Size",
      "min": 48,
      "max": 200,
      "default": 130
    }
  ]
}
```

**Slot types:**
- `text` — editable text content, respects `maxChars`
- `css_var` — updates a CSS custom property on `:root`
- `font_size` — slider that sets inline font-size on matching elements
- `toggle` — show/hide an element

Only `[data-slot]` annotated elements are editable. Nothing else in the HTML is touchable.

---

## User Flows

### Flow 1: Generate → Build → Export

```
1. New Carousel
   └── Input: topic / article URL / script / writeup (any combo, all optional)
   └── Article URLs are passed as text context to the AI — no scraping in this version
   └── Select platform

2. AI Conversation (cheap model, max 3 follow-ups)
   └── AI asks: tone, target audience, CTA goal
   └── Quick-reply chips + optional free text
   └── User approves script → proceed (or requests variation)

3. Configure
   └── Slide count: slider (3–15)
   └── Canvas size checklist:
       ☐ 1080×1080  (Instagram square / LinkedIn)
       ☑ 1080×1350  (Instagram portrait) ← default
       ☐ 1080×1920  (Stories / TikTok)
       ☐ 1080×1300  (LinkedIn native)
       ☐ 1200×628   (LinkedIn link preview)

4. Pick Template
   └── Gallery: system templates + user's own templates
   └── Filter by platform, canvas size
   └── AI auto-maps copy into template slots (cheap model)

5. Editor
   └── Slide preview (iframe, 50% scale)
   └── Click element → property panel (right sidebar)
   └── Thumbnail strip for slide navigation
   └── Autosave to PocketBase (debounced 1.5s)

6. Export
   └── "Export ZIP" → for each slide:
       1. Parent sends { type: 'CAPTURE' } to iframe
       2. Iframe script runs dom-to-image-more on the .slide element → data URL
       3. Iframe sends { type: 'CAPTURE_RESULT', dataUrl } back to parent
       4. Parent collects all data URLs → JSZip → download
   └── slide-01.png … slide-N.png at full canvas resolution (2× device scale)
```

### Flow 2: Create Template from PNG

```
1. Upload 1–3 reference PNG screenshots
2. Optional: describe the style in text
3. AI (good model) generates HTML/CSS following template spec
4. User previews result
5. Edit in template editor (same editor + Schema tab to define/label slots)
6. Save to My Templates
   └── Admin option: Publish to System Templates
```

### Flow 3: Brand Profile (lazy, post-first-export)

After first carousel is exported, a dismissible prompt appears:
*"Save your brand details to personalise future carousels"*

Collects: display name, brand name, handle, accent color, tone, target audience, default platform. Stored on user record. Injected into all subsequent AI prompts automatically.

---

## AI Prompt Architecture

### User context object (injected into all prompts once profile exists)
```json
{
  "brand": "Aditya | FinanceFirst",
  "handle": "@aditya_ff",
  "audience": "retail investors, 25–40",
  "tone": "bold, direct, no fluff",
  "platform": "LinkedIn",
  "cta_default": "Follow for more"
}
```

### Prompt 1 — Copy Generation (cheap model)
- **Model:** DeepSeek-V3 or Gemini Flash via OpenRouter
- **System prompt rules (strict):**
  - Output JSON only — no prose, no markdown wrapper
  - Schema: `{ hook: string, slides: [{ headline: string, body: string, stat?: string, quote?: string }], cta: string }`
  - hook ≤ 12 words, headline ≤ 8 words, body ≤ 40 words
  - Viral hook formulas: numbered lists, counterintuitive opener, "most people don't know"
  - Platform-specific SEO rules (LinkedIn keyword density, Instagram hashtag slots)
  - User context injected at top of system prompt
- **Flow:** max 3 follow-up questions as structured chips → one final generation → user approves or requests variation

### Prompt 2 — Slot Fill (cheap model)
- **Model:** DeepSeek-V3 or Gemini Flash
- **Input:** generated copy JSON + template `schema_json` (slot list with `maxChars`, `label`, `slide`)
- **Output:** flat JSON mapping only: `{ "s1_headline": "content", "s2_body": "content" }`
- **Rules:** never exceed `maxChars`, preserve tone, abbreviate gracefully, never invent content not in copy JSON

### Prompt 3 — Template Generation from PNG (good model only)
- **Model:** Claude Haiku or Gemini 1.5 Pro via OpenRouter
- **System prompt includes:**
  - Full template HTML spec (canvas size, `.slide` structure, CSS variable conventions, `data-slot` annotation rules, Google Fonts usage pattern)
  - One complete existing template as worked example
  - Slot annotation rules: every editable element must have `data-slot="unique_id"`
  - CSS variable conventions: all colours as `--var-name`, all font sizes as CSS vars
- **Output:** single self-contained HTML file only — no explanation, no markdown fences

---

## Editor Implementation

### Rendering
Each slide rendered in `<iframe sandbox="allow-scripts allow-same-origin">` at 1080×1350px (or selected canvas size), scaled down via `transform: scale(0.5)` — same approach as existing carousel system.

Templates are **served through a Next.js API proxy route** (`/api/template/[id]`) rather than directly from PocketBase storage. This makes the iframe same-origin as the app, which is required for both the postMessage bridge and client-side export to work correctly.

### Click → Property Panel bridge
A script injected into the iframe at load time:
1. Attaches click listeners to all `[data-slot]` elements
2. On click: `window.parent.postMessage({ type: 'SLOT_CLICK', slotId, currentValue }, '*')`
3. Parent receives → looks up slot definition in `schema_json` → renders appropriate control in property panel

### Property panel controls
| Slot type | Control |
|---|---|
| `text` | Textarea with live char count + maxChars warning |
| `css_var` | react-colorful color picker |
| `font_size` | Range slider |
| `toggle` | On/off switch |

### Applying changes
Parent sends `{ type: 'UPDATE_SLOT', slotId, value }` to iframe. Iframe applies:
- `text` → `element.textContent = value`
- `css_var` → `document.documentElement.style.setProperty('--var', value)`
- `font_size` → `element.style.fontSize = value + 'px'`
- `toggle` → `element.style.display = value ? '' : 'none'`

### Autosave
All slot values written back into `slides_json` in PocketBase. Debounced 1.5s on every change.

### Template editor (schema tab)
Same editor with an additional "Schema" tab in the property panel. Allows defining new slots (id, label, type, maxChars, selector), previewing them live, and saving the updated `schema_json`. Used when creating or editing templates before publishing.

---

## File Structure

```
carousel-webapp/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                   ← auth guard, sidebar nav
│   │   ├── dashboard/page.tsx           ← carousel history + quick actions
│   │   ├── generate/page.tsx            ← copy gen conversation flow
│   │   ├── builder/[id]/page.tsx        ← editor: preview + property panel
│   │   ├── templates/page.tsx           ← template gallery
│   │   ├── templates/new/page.tsx       ← create template from PNG
│   │   └── settings/page.tsx            ← brand profile
│   └── api/
│       ├── ai/generate-copy/route.ts    ← OpenRouter cheap model, streaming
│       ├── ai/fill-slots/route.ts       ← OpenRouter cheap model
│       ├── ai/generate-template/route.ts ← OpenRouter good model
│       └── template/[id]/route.ts       ← proxy: serves template HTML same-origin for iframe
│
├── lib/
│   ├── pocketbase.ts          ← typed PocketBase client + collection types
│   ├── openrouter.ts          ← model config, cheap vs good routing, fetch wrapper
│   ├── template-engine.ts     ← slot injection into HTML, schema parsing, iframe bridge protocol
│   └── export.ts              ← dom-to-image-more + JSZip pipeline
│
├── components/
│   ├── editor/
│   │   ├── SlidePreview.tsx        ← iframe wrapper + postMessage listener
│   │   ├── PropertyPanel.tsx       ← slot controls (text/color/size/toggle)
│   │   ├── SlideThumbnails.tsx     ← bottom slide nav strip
│   │   └── SchemaEditor.tsx        ← slot definition UI (template editor only)
│   ├── generate/
│   │   ├── CopyChat.tsx            ← conversation UI, quick-reply chips
│   │   └── ScriptPreview.tsx       ← generated script review + inline edit
│   ├── templates/
│   │   ├── TemplateCard.tsx
│   │   ├── TemplatePicker.tsx
│   │   └── PngUploader.tsx         ← drag-drop PNG upload for template gen
│   └── ui/                         ← shadcn/ui components
│
├── hooks/
│   ├── useCarousel.ts          ← CRUD + autosave to PocketBase
│   ├── useTemplateSchema.ts    ← parse schema, resolve slot values
│   └── useExport.ts            ← dom-to-image + zip orchestration
│
└── types/
    ├── carousel.ts             ← Carousel, Slide, SlotValue
    └── template.ts             ← Template, SlotDefinition, SchemaJson
```

---

## OSS Dependencies

| Package | Purpose |
|---|---|
| `pocketbase` | PocketBase JS SDK |
| `dom-to-image-more` | Client-side slide screenshot |
| `jszip` | Bundle PNGs into ZIP |
| `react-colorful` | Lightweight color picker (~3kb) |
| `shadcn/ui` | UI component system |
| `openai` (npm) | OpenRouter-compatible API client |

---

## Future: Puppeteer Export Upgrade

When pixel-perfect exports are required:
1. Add a Node.js + Puppeteer service on Fly.io (port the existing `export-slides.js`)
2. Create `app/api/export/route.ts` that calls the Puppeteer service
3. Update `lib/export.ts` to call the API route instead of dom-to-image
4. No other changes required — the rest of the system is unaffected

---

## Out of Scope (this version)

- Image generation (no AI image gen anywhere in this build)
- Public signup / billing (private tool first)
- Real-time collaboration
- Animation/video export
