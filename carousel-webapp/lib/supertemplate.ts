// carousel-webapp/lib/supertemplate.ts
import type { TemplateJson } from '@/types/template'
import type { ContentJson } from '@/types/carousel'

// The supertemplate schema describes what fields a TemplateJson must have.
// Used as the output schema in the vision extraction prompt.
export const SUPERTEMPLATE_SCHEMA = {
  colors: { primary: 'string (hex)', dark: 'string (hex)', accent: 'string (hex)', white: 'string (hex)' },
  typography: {
    display: { family: 'string', weights: 'number[]', googleFonts: 'string' },
    body:    { family: 'string', weights: 'number[]', googleFonts: 'string' },
    serif:   { family: 'string', weights: 'number[]', googleFonts: 'string' },
  },
  typescale: 'Record<string, { size, weight, lineHeight?, letterSpacing?, transform?, style?, font?, opacity? }>',
  spacing: { slidePadding: 'number (px)', cardPadding: 'number (px)', sectionGap: 'number (px)', cardRadius: 'number (px)', tagRadius: 'string' },
  components: 'Record<string, unknown> — describe tag, circleBtn, starAccent, ovalAccent, etc.',
  slideLayouts: 'Record<layoutName, { background, foreground, structure, slots: Record<slotName, description>, use }>',
  slideSequenceRules: {
    first: 'string (layout name)',
    last: 'string (layout name)',
    variation: 'string',
    recommended: 'Record<slideCount, layoutName[]>',
  },
  exportSettings: { deviceScaleFactor: 'number', outputSize: 'string', logicalSize: 'string', format: 'string', exportScript: 'string' },
  generationRules: 'Record<string, string>',
}

export function buildExtractionPrompt(): string {
  return `You are a design system analyst. Analyse the provided carousel reference images and extract a complete design system JSON.

OUTPUT SCHEMA (fill every field with real values from the images):
${JSON.stringify(SUPERTEMPLATE_SCHEMA, null, 2)}

Rules:
- Return ONLY valid JSON. No explanation, no markdown fences.
- Extract actual hex colors, font families, and pixel sizes from the images.
- For slideLayouts, identify each distinct slide type you see and describe its structure.
- If a field is not visible in the images, use a sensible default.`
}

export function buildPlanPrompt(
  rawContent: string,
  templateJson: TemplateJson,
  slideCount: number,
  brand: { brand: string; platform: string }
): string {
  const sequence = templateJson.slideSequenceRules.recommended[String(slideCount)]
    ?? templateJson.slideSequenceRules.recommended['6']
    ?? ['cover', 'data', 'insight', 'card', 'quote', 'cta'].slice(0, slideCount)

  return `You are a LinkedIn carousel content strategist.

BRAND: ${brand.brand}
PLATFORM: ${brand.platform}
SLIDE COUNT: ${slideCount}
SLIDE SEQUENCE: ${JSON.stringify(sequence)}

DESIGN SYSTEM (slide layouts available):
${JSON.stringify(templateJson.slideLayouts, null, 2)}

RAW CONTENT:
${rawContent}

TASK: Convert the raw content into exactly ${slideCount} slides following the sequence above.
For each slide, output only the fields defined by its layout type.

OUTPUT FORMAT — return ONLY this JSON (no explanation, no markdown fences):
{
  "meta": {
    "topic": "string",
    "brand": "${brand.brand}",
    "slideCount": ${slideCount},
    "platform": "${brand.platform}"
  },
  "slides": [
    {
      "id": "s1",
      "layout": "${sequence[0]}",
      ... layout-specific fields
    }
  ]
}

LAYOUT FIELD RULES:
- cover: topicTag (string), categoryTag (string), headline (string[] — 2-5 words stacked), circledWord (number 0-based index), tagline (string)
- data: brand (string in BRACKETS), date (string), stat (string number), unit (string), dataLabel (string), caption (string[] 2-3 lines)
- card: eyebrow (string), stmt (string), body (string), ctaLabel? (string)
- insight: brand (string), headline (string[] 2-3 words), accentWord? (number), caption (string[] 2-3 lines)
- quote: eyebrow (string), headline (string[] 2-3 words), body (string), tagline? (string)
- cta: eyebrow (string), stmt (string), body (string), ctaLabel (string)
- opinion: brand (string), eyebrow (string), headline (string[]), accentWord? (number), quote (string), ctaText (string)

Keep copy SHORT and PUNCHY. LinkedIn audience. First slide must hook. Last slide drives action.`
}

export function buildRenderPrompt(templateJson: TemplateJson, contentJson: ContentJson): string {
  return `You are an expert HTML/CSS engineer. Generate a complete self-contained HTML carousel file.

TEMPLATE DESIGN SYSTEM:
${JSON.stringify(templateJson, null, 2)}

CONTENT:
${JSON.stringify(contentJson, null, 2)}

REQUIREMENTS:
1. Canvas: 1080×1350px per slide. Preview scale: 0.5 via CSS transform.
2. One .slide div per slide with id matching content slide ids (s1, s2, ...).
3. All CSS inline in a <style> block. Use CSS custom properties from the design system.
4. Google Fonts <link> in <head> for all fonts used.
5. Apply ALL content from the CONTENT JSON to the correct slides.
6. Navigation JS at bottom: prev/next buttons, dot indicators, keyboard (ArrowLeft/ArrowRight), swipe support.
7. First slide has class "active", others hidden.
8. Above </body>, add a CONTENT block:

<script>
/* ════════════════════════════════════════════════════════════
   CONTENT — edit all slide text here without touching layout
   ════════════════════════════════════════════════════════════ */
const SLIDES = ${JSON.stringify(
    Object.fromEntries(contentJson.slides.map(s => [s.id, s])),
    null, 2
  )}
// Apply content to DOM
document.addEventListener('DOMContentLoaded', () => {
  // populate each slide from SLIDES object
  // ... (implement for each slide's fields)
})
</script>

OUTPUT: Return ONLY the complete HTML file. No explanation. No markdown fences.`
}
