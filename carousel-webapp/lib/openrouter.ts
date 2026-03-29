import OpenAI from 'openai'
import type { UserContext } from './pocketbase'
import type { GeneratedCopy } from '@/types/carousel'
import type { SlotDefinition } from '@/types/template'

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY ?? ''
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://carousel-generator.app',
      'X-Title': 'Carousel Generator',
    },
  })
}

export const CHEAP_MODEL =
  process.env.OPENROUTER_CHEAP_MODEL ?? 'deepseek/deepseek-chat'
export const GOOD_MODEL =
  process.env.OPENROUTER_GOOD_MODEL ?? 'anthropic/claude-3.5-sonnet'

// ── Prompt builders ────────────────────────────────────────────────────────

export function buildCopyGenSystemPrompt(ctx: UserContext | null, slideCount = 5): string {
  const userBlock = ctx
    ? `## Creator Context
Brand: ${ctx.brand}
Handle: ${ctx.handle}
Target audience: ${ctx.audience}
Tone: ${ctx.tone}
Platform: ${ctx.platform}
Default CTA: ${ctx.ctaDefault}

Write in this creator's voice and for their specific audience.`
    : '## Creator Context\nNo brand profile set — use a professional, engaging tone.'

  return `You are an expert social media copywriter specialising in viral carousel content.

${userBlock}

## Output Rules (STRICT)
- Output ONLY a raw JSON object — absolutely no markdown, no \`\`\`json fences, no explanation, no prose before or after
- Your entire response must start with { and end with }
- JSON schema: { "hook": string, "slides": [{ "headline": string, "body": string, "stat"?: string, "quote"?: string }], "cta": string }
- slides array must contain exactly ${slideCount} items
- hook: max 12 words, must create immediate curiosity or bold claim
- headline: max 8 words per slide, punchy
- body: max 40 words per slide, one clear idea
- cta: max 10 words, actionable
- Use viral hook formulas: numbered lists, counterintuitive openers, "most people don't know", bold data claims
- LinkedIn: use keywords naturally, professional hashtags at end of cta
- Instagram: conversational, 1-2 hashtags inline
- Never hallucinate facts — only use information provided by the user`
}

export function buildSlotFillPrompt(
  slots: SlotDefinition[],
  copy: GeneratedCopy
): string {
  const textSlots = slots.filter(s => s.type === 'text')
  const slotList = textSlots
    .map(
      s =>
        `- "${s.id}" (slide ${s.slide}, label: "${s.label}"${s.maxChars ? `, maxChars: ${s.maxChars}` : ''})`
    )
    .join('\n')

  const sections = [
    'Map the following carousel copy into every template slot. Fill ALL slots — leave NONE empty.',
    `## Generated Copy\n${JSON.stringify(copy, null, 2)}`,
    `## Template Slots\n${slotList}`,
    [
      '## Mapping Rules (STRICT)',
      '- Output a single flat JSON object only: { "slot_id": "value", ... } — all slots must appear',
      '- Never exceed maxChars for any slot — abbreviate gracefully if needed',
      '- Preserve the creator\'s tone exactly',
      '',
      '## Slot Type Guide (use label to infer slot purpose)',
      '- headline / title / hook → use the slide\'s headline from "slides[n].headline"',
      '- body / text / description / content → use "slides[n].body"',
      '- stat / number / figure → use "slides[n].stat" if present, else extract a key number from the body',
      '- quote / pullquote → use "slides[n].quote" if present, else extract the punchiest line from the body',
      '- cta / follow / action → use the "cta" field',
      '- brand / handle / creator / author → use "@creator" (no real brand info available)',
      '- date / time / when → use "Today"',
      '- category / tag / topic / label / genre → derive a 1-3 word category from the carousel topic (e.g. "AI & Tech", "Finance", "Health")',
      '- source / attribution / via → use "Source" or derive from context',
      '- numbered list slots (e.g. "CIRCLED LINE ONE", "CIRCLED LINE TWO", "Point 1", "Step 2") → CRITICAL: these form a split multi-part headline. Treat them as one headline broken into single words or 2-word phrases across the numbered slots in order. Each numbered slot must contain ONLY 1-3 words — never a full sentence. E.g. if headline is "AI Changes Video" split into: line1="AI", line2="CHANGES", line3="VIDEO". If there are more slots than words, use a relevant single word from the body for extras.',
      '- italic / caption / label / sub / note → use a short punchy phrase (3-7 words) from the body or cta',
      '- any remaining slot → use the most contextually appropriate short phrase from the copy',
    ].join('\n'),
  ]
  return sections.join('\n\n')
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function streamCopyGeneration(
  messages: OpenAI.ChatCompletionMessageParam[],
  userContext: UserContext | null,
  slideCount = 5
): Promise<ReadableStream<string>> {
  const openai = getClient()
  const stream = await openai.chat.completions.create({
    model: CHEAP_MODEL,
    messages: [
      { role: 'system', content: buildCopyGenSystemPrompt(userContext, slideCount) },
      ...messages,
    ],
    stream: true,
    temperature: 0.7,
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? ''
          if (delta) controller.enqueue(delta)
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

export async function fillSlots(
  slots: SlotDefinition[],
  copy: GeneratedCopy
): Promise<Record<string, string>> {
  const openai = getClient()
  const response = await openai.chat.completions.create({
    model: CHEAP_MODEL,
    messages: [{ role: 'user', content: buildSlotFillPrompt(slots, copy) }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  const content = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(content) as Record<string, string>
}

// ─── Template Generation (GOOD_MODEL only) ────────────────────────────────────

const MULTI_SLIDE_EXAMPLE = `<!DOCTYPE html>
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
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1080px; height: 1350px; overflow: hidden; background: var(--bg); }
.viewer { position: relative; width: 1080px; height: 1350px; overflow: hidden; }
.slide {
  position: absolute; top: 0; left: 0;
  width: 1080px; height: 1350px;
  display: none; flex-direction: column; padding: 72px;
}
.slide.active { display: flex; }
/* --- Slide 1: Cover --- */
.s1-tag { font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 600; color: var(--accent); letter-spacing: 0.12em; text-transform: uppercase; }
.s1-headline { font-family: 'Barlow Condensed', sans-serif; font-size: 140px; font-weight: 900; line-height: 0.92; color: var(--dark); text-transform: uppercase; margin-top: 32px; }
.s1-brand { font-family: 'DM Sans', sans-serif; font-size: 24px; color: var(--accent); font-weight: 600; margin-top: auto; letter-spacing: 0.1em; text-transform: uppercase; }
/* --- Slide 3: Stat --- */
.s3-label { font-family: 'DM Sans', sans-serif; font-size: 28px; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
.s3-stat { font-family: 'Barlow Condensed', sans-serif; font-size: 220px; font-weight: 900; color: var(--dark); line-height: 0.9; margin-top: 16px; }
.s3-context { font-family: 'DM Sans', sans-serif; font-size: 34px; color: var(--dark); margin-top: 32px; max-width: 800px; }
/* --- Slide 8: CTA --- */
.s8-cta { font-family: 'Barlow Condensed', sans-serif; font-size: 120px; font-weight: 900; line-height: 0.92; color: var(--dark); text-transform: uppercase; margin-top: auto; }
.s8-handle { font-family: 'DM Sans', sans-serif; font-size: 30px; color: var(--accent); font-weight: 600; margin-top: 48px; margin-bottom: auto; }
</style>
</head>
<body>
<div class="viewer">
  <!-- SLIDE 1: Cover/Hook -->
  <div class="slide active">
    <span class="s1-tag" data-slot="s1_tag">Finance Tips</span>
    <h1 class="s1-headline" data-slot="s1_headline">Most Investors Get This Wrong</h1>
    <p class="s1-brand" data-slot="s1_brand">FinanceFirst</p>
  </div>
  <!-- SLIDE 3: Stat/Data (slides 2,4,5,6,7 follow same pattern — distinct layouts each) -->
  <div class="slide">
    <span class="s3-label" data-slot="s3_label">The Reality</span>
    <p class="s3-stat" data-slot="s3_stat">73%</p>
    <p class="s3-context" data-slot="s3_context">of retail investors underperform the index every single year</p>
  </div>
  <!-- SLIDE 8: CTA/Ending -->
  <div class="slide">
    <h2 class="s8-cta" data-slot="s8_cta">Follow For Daily Finance Tips</h2>
    <p class="s8-handle" data-slot="s8_handle">@FinanceFirst</p>
  </div>
</div>
</body>
</html>`

export function buildTemplateGenSystemPrompt(): string {
  return `You are an expert HTML/CSS designer specialising in social media carousel slides.

## TASK
Generate a complete 8-slide carousel HTML file where EACH SLIDE has a DISTINCT visual layout and purpose. Match the style of the reference images closely.

## SLIDE ROLES — generate one of each, in this order
1. **Cover/Hook** (s1_*) — Bold oversized headline, brand name. Stops the scroll. Minimal text.
2. **Problem** (s2_*) — Headline + body text describing the pain point or challenge.
3. **Stat/Data** (s3_*) — Oversized number/statistic dominating the layout + brief context.
4. **Solution** (s4_*) — Headline + actionable body text (the core insight).
5. **Deep Dive** (s5_*) — Headline + longer body copy. Most text-heavy slide.
6. **Quote** (s6_*) — Large pull quote filling the slide + attribution line.
7. **Tips/List** (s7_*) — Headline + three separate tip slots (s7_tip1, s7_tip2, s7_tip3).
8. **CTA/Ending** (s8_*) — Strong call to action + brand handle. Mirrors the cover energy.

## REQUIRED SPECIFICATIONS
- Canvas: exactly 1080×1350px (body, .viewer, and each .slide element)
- 8 \`<div class="slide">\` elements inside \`<div class="viewer">\` — first has class \`slide active\`
- **CRITICAL: NO transform:scale() anywhere** — the editor handles all scaling externally
- CSS: \`.slide { display:none }\` / \`.slide.active { display:flex }\`
- .viewer: \`position:relative; width:1080px; height:1350px; overflow:hidden\`
- Each .slide: \`position:absolute; top:0; left:0; width:1080px; height:1350px\`
- Minimum inner padding: 72px on all sides for each slide
- Load fonts from Google Fonts only
- All colours must be CSS custom properties on :root (--accent, --bg, --dark, etc.)

## SLOT ANNOTATION RULES
Every editable text element MUST have: \`data-slot="s{N}_{role}"\` where N is slide number 1–8

Required slots per slide:
- s1_headline, s1_brand — Cover
- s2_headline, s2_body — Problem
- s3_stat, s3_context — Stat
- s4_headline, s4_body — Solution
- s5_headline, s5_body — Deep Dive
- s6_quote, s6_attribution — Quote
- s7_headline, s7_tip1, s7_tip2, s7_tip3 — Tips
- s8_cta, s8_handle — CTA

## CSS VARIABLE CONVENTIONS
:root {
  --accent: #E05828;  /* primary accent colour */
  --bg: #F0EDE5;      /* slide background colour */
  --dark: #111110;    /* primary text colour */
  --sw: 1080px;
  --sh: 1350px;
}

## WORKED EXAMPLE (3 of 8 slides shown — generate all 8 following the same pattern)
${MULTI_SLIDE_EXAMPLE}

## OUTPUT RULES
- Output HTML only — no explanation, no markdown fences, no code block wrappers
- The entire response must be a valid complete HTML document starting with <!DOCTYPE html>
- Must be self-contained (no external JS; Google Fonts only for external resources)
- All 8 slides required with distinct layouts — do not reuse the same layout across slides
- Match the visual style, layout, colours, and typography of the reference images`
}

export async function generateTemplate(
  images: string[],
  description?: string
): Promise<string> {
  const openai = getClient()
  const response = await openai.chat.completions.create({
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

  const html = response.choices?.[0]?.message?.content ?? ''
  // Strip any accidental markdown fences the model may have wrapped the output in
  return html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
}
