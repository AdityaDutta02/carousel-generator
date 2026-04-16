# Carousel Generator v2 — Design Spec
**Date:** 2026-04-14
**Status:** Approved
**Branch:** v2

---

## What We're Building

A redesigned carousel creation app. v1 used a complex slot/template system where AI generated HTML from PNG references and users edited content via data-slot attributes. v2 replaces that entirely with a two-JSON, two-step generation model:

1. **Template JSON** — a design system extracted from reference images (visual style, colours, fonts, slide layouts)
2. **Content JSON** — a slide plan generated from user's raw content (what each slide says)

A code model combines them to produce a complete, self-contained HTML carousel. Users edit content via a form panel that reads/writes the Content JSON. HTML is re-rendered on save.

No Claude is used anywhere. All models are via OpenRouter (Qwen/DeepSeek).

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend + API | Next.js App Router (TypeScript) | Unchanged from v1 |
| DB + Auth | PocketBase on Fly.io | Unchanged from v1 |
| AI | OpenRouter — Qwen/DeepSeek only | No Claude |
| UI | shadcn/ui + Tailwind | Unchanged from v1 |
| Export | dom-to-image-more + JSZip (client-side) | Unchanged from v1 |

**Model assignments:**
| Task | Model |
|---|---|
| Template extraction (vision) | `qwen/qwen2.5-vl-72b-instruct` |
| Content planning — step 1 | `deepseek/deepseek-chat` |
| HTML rendering — step 2 | `qwen/qwen2.5-coder-32b-instruct` |

All model IDs are env vars (`VISION_MODEL`, `PLAN_MODEL`, `RENDER_MODEL`) — swappable without code changes.

---

## What v2 Removes from v1

The following v1 concepts are entirely eliminated:

- `data-slot` attribute system
- Schema auto-detection (`autoDetectSchema`)
- `buildSrcdoc` pipeline (`injectCanvasSize`, `injectAllSlotValues`, `activateSlide`, `injectBridgeScript`)
- iframe postMessage bridge (`UPDATE_SLOT`, `SWITCH_SLIDE`, `CAPTURE`, `SLOT_CLICK`, `CAPTURE_RESULT`)
- Template HTML blob storage in PocketBase
- `SlidePreview.tsx` postMessage orchestration

---

## Architecture

```
TEMPLATE CREATION
  reference images (1–3 PNGs) + supertemplate JSON (in code)
    → POST /api/templates/extract
    → [Qwen Vision] → Template JSON
    → user reviews/edits → save to PocketBase templates collection

CAROUSEL GENERATION
  raw content (article/bullets) + template_id + slide_count
    → POST /api/carousels/plan
    → [DeepSeek] → content JSON (slide plan)        ← step 1

  content JSON + template JSON
    → POST /api/carousels/render
    → [Qwen Coder] → complete HTML                  ← step 2

  stored in PocketBase: content_json + template_id + html_cache

EDITING
  user edits ContentForm → updates content JSON in state
  "Re-render" → POST /api/carousels/render → new HTML → update html_cache

EXPORT
  html_cache → dom-to-image per .slide element → JSZip → download
```

---

## JSON Formats

### Supertemplate JSON (`/lib/supertemplate.ts` — in code, not in DB)

Defines the schema that all Template JSONs must conform to. Used as the output schema in the extraction prompt. Based on `carousel-design-system.json` (already in repo root).

Fields it defines: `colors`, `typography`, `typescale`, `spacing`, `components`, `slideLayouts`, `slideSequenceRules`, `exportSettings`.

### Template JSON (stored in PocketBase `templates.template_json`)

A filled instance of the supertemplate schema. Produced by the vision model analysing reference carousel images. Contains actual hex values, font families, px sizes, and slide layout definitions.

### Content JSON (stored in PocketBase `carousels.content_json`)

```json
{
  "meta": {
    "topic": "HDFC Crisis",
    "brand": "Aditya",
    "slideCount": 7,
    "platform": "LinkedIn"
  },
  "slides": [
    {
      "id": "s1",
      "layout": "cover",
      "topicTag": "FINANCE",
      "categoryTag": "BREAKING",
      "headline": ["HDFC", "JUST", "CRASHED"],
      "circledWord": 2,
      "tagline": "What actually happened."
    },
    {
      "id": "s2",
      "layout": "data",
      "brand": "[THE NUMBER]",
      "date": "APR 2026",
      "stat": "22",
      "unit": "%",
      "dataLabel": "Drop in 3 days.",
      "caption": ["₹2.3L crore wiped out.", "In 72 hours."]
    },
    {
      "id": "s7",
      "layout": "cta",
      "eyebrow": "FOLLOW FOR MORE",
      "stmt": "STAY\nAHEAD.",
      "body": "Weekly finance breakdowns.",
      "ctaLabel": "FOLLOW ME"
    }
  ]
}
```

The content form renders this schema as inputs. Field types are inferred: arrays → multi-line textarea, short strings → single-line input, numbers → number input.

---

## Data Models

### `templates` collection
| Field | Type | Notes |
|---|---|---|
| name | text | "Editorial Dark", "Notebook" |
| template_json | json | Full design system instance |
| thumbnail | file | Preview image |
| is_system | bool | Admin-published, visible to all users |
| created_by | relation → users | |

### `carousels` collection
| Field | Type | Notes |
|---|---|---|
| name | text | |
| template_id | relation → templates | |
| content_json | json | Slide plan |
| html_cache | text | Last-rendered HTML blob |
| slide_count | number | |
| platform | select | LinkedIn / Instagram |
| status | select | draft / published |
| created_by | relation → users | |

### `users` collection
Unchanged from v1 — `display_name`, `brand_name`, `handle`, `accent_color`, `tone`, `platform_preference`, `role`.

---

## Pages

```
app/(app)/
  templates/
    page.tsx          — Template library: grid of system + own templates
    new/page.tsx      — 3-step wizard: upload refs → review JSON → name + save
    [id]/page.tsx     — View/edit template JSON, re-extract, delete
  carousels/
    page.tsx          — Carousel list
    new/page.tsx      — 3-step wizard: pick template → paste content + slide count → generate
    [id]/page.tsx     — Split editor: ContentForm (left) + iframe preview (right) + export
```

---

## API Routes (3 total)

### `POST /api/templates/extract`
**Input:** `{ images: string[] (base64), supertemplateSchema: object }`
**Output:** `{ templateJson: object }`
**Model:** Qwen Vision
**Prompt:** Supertemplate schema as output schema, images as vision input, return filled JSON only.

### `POST /api/carousels/plan`
**Input:** `{ content: string, templateJson: object, slideCount: number, brand: UserBrand }`
**Output:** `{ contentJson: ContentJson }`
**Model:** DeepSeek
**Prompt:** Slide sequence from template, platform, brand context, raw content → structured slide plan.

### `POST /api/carousels/render`
**Input:** `{ contentJson: ContentJson, templateJson: object }`
**Output:** `{ html: string }`
**Model:** Qwen Coder
**Prompt:** Design system + slide content → self-contained HTML carousel. Canvas 1080×1350px, preview scale 0.5, CONTENT block at bottom, Google Fonts, JS nav.

---

## Key Library Files

```
lib/
  models.ts          — OpenRouter client, model constants (VISION_MODEL, PLAN_MODEL, RENDER_MODEL)
  supertemplate.ts   — Supertemplate schema object + extraction prompt builder
  html-renderer.ts   — Render prompt builder: template JSON + content JSON → prompt string
  content-form.ts    — content JSON → FormFieldGroup[] (type inference, labels)
  export.ts          — dom-to-image per .slide + JSZip (unchanged from v1)
  pocketbase.ts      — PocketBase client + typed accessors for templates/carousels/users

types/
  template.ts        — TemplateJson, SupertemplateSchema
  carousel.ts        — ContentJson, SlideContent, FormFieldGroup
```

---

## Editor Page (`carousels/[id]/page.tsx`)

Split-pane layout:
- **Left (40%):** `ContentForm` component — one collapsible section per slide, fields derived from `content_json` shape
- **Right (60%):** `<iframe srcDoc={htmlCache}>` — live preview at scaled-down size
- **Top bar:** carousel name (editable), "Re-render" button, "Export" button, back nav

Re-render flow:
1. User edits field in ContentForm → local state update (no API call)
2. User clicks "Re-render" button (manual only — avoids API cost per keystroke)
3. POST `/api/carousels/render` with updated content_json + template_json
4. Response HTML → update iframe srcDoc + PATCH carousels record (html_cache + content_json)

Export flow:
1. User clicks "Export"
2. `export.ts`: for each `.slide` in iframe → `domtoimage.toPng()` → push to array
3. JSZip → download as `{carousel-name}.zip`

---

## Template Creation Page (`templates/new/page.tsx`)

3-step wizard:

**Step 1 — Upload references**
Drag-drop up to 3 PNG carousel screenshots. Stored as base64 in component state.

**Step 2 — Extract + review**
POST `/api/templates/extract`. Show extracted Template JSON in a read-only JSON viewer with inline edit capability. User can fix any extraction errors before saving.

**Step 3 — Save**
Name the template, set thumbnail (auto-captured from first reference or uploaded). POST to PocketBase. Admin users see an "Is system template" toggle.

---

## Carousel Creation Page (`carousels/new/page.tsx`)

3-step wizard:

**Step 1 — Pick template**
Grid of available templates (system + own). Click to select, shows preview.

**Step 2 — Content + settings**
Textarea for raw content (article, bullets, script). Slide count selector (4–10). Platform selector (LinkedIn/Instagram).

**Step 3 — Generate**
1. POST `/api/carousels/plan` → content_json
2. POST `/api/carousels/render` → html
3. POST to PocketBase (create carousel record)
4. Redirect to `/carousels/[id]`

Loading state shows two progress steps ("Planning slides…" → "Rendering HTML…").

---

## Parallel Implementation Plan (Worktrees)

Designed for parallel agent execution on the `v2` branch:

| Agent | Scope | Depends on |
|---|---|---|
| 1 — Foundation | PocketBase migrations, `lib/models.ts`, `lib/pocketbase.ts`, `types/` | nothing |
| 2 — Prompts | `lib/supertemplate.ts`, `lib/html-renderer.ts`, all 3 API routes | Agent 1 types |
| 3 — Template flow | `templates/new`, `templates/[id]`, `templates/page.tsx` | Agent 1 + 2 |
| 4 — Carousel flow | `carousels/new`, `carousels/[id]` (editor + export), `carousels/page.tsx` | Agent 1 + 2 |

Agents 3 and 4 can run in parallel after Agents 1 and 2 complete.

---

## Success Criteria

- Admin can upload 2–3 reference carousel PNGs and get a Template JSON saved in under 30 seconds
- User can paste an article, pick a template, and get a rendered carousel HTML in under 20 seconds
- Content form correctly reflects all slide fields from the generated content_json
- Re-render produces updated HTML in under 15 seconds
- Export produces a ZIP of correctly-cropped PNGs (one per slide) matching the canvas dimensions
- Zero use of Claude or Anthropic models anywhere in the pipeline
