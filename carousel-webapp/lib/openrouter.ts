import OpenAI from 'openai'
import type { UserContext } from './pocketbase'
import type { GeneratedCopy } from '@/types/carousel'
import type { SlotDefinition } from '@/types/template'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      defaultHeaders: {
        'HTTP-Referer': 'https://carousel-generator.app',
        'X-Title': 'Carousel Generator',
      },
    })
  }
  return client
}

export const CHEAP_MODEL =
  process.env.OPENROUTER_CHEAP_MODEL ?? 'deepseek/deepseek-chat'
export const GOOD_MODEL =
  process.env.OPENROUTER_GOOD_MODEL ?? 'anthropic/claude-haiku-4-5'

// ── Prompt builders ────────────────────────────────────────────────────────

export function buildCopyGenSystemPrompt(ctx: UserContext | null): string {
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
- Output JSON only — no prose, no markdown fences, no explanation
- JSON schema: { "hook": string, "slides": [{ "headline": string, "body": string, "stat"?: string, "quote"?: string }], "cta": string }
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
  const slotList = slots
    .filter(s => s.type === 'text')
    .map(
      s =>
        `- "${s.id}" (slide ${s.slide}, label: "${s.label}", maxChars: ${s.maxChars ?? 'none'})`
    )
    .join('\n')

  const sections = [
    'Map the following generated copy into the carousel template slots.',
    `## Template Slots\n${slotList}`,
    `## Generated Copy\n${JSON.stringify(copy, null, 2)}`,
    [
      '## Rules (STRICT)',
      '- Output a single flat JSON object only: { "slot_id": "content", ... }',
      '- Never exceed maxChars for any slot — abbreviate gracefully if needed',
      '- Never invent content not present in the generated copy',
      '- Preserve the creator\'s tone exactly',
      '- If a slot has no matching copy, use an empty string ""',
    ].join('\n'),
  ]
  return sections.join('\n\n')
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function streamCopyGeneration(
  messages: OpenAI.ChatCompletionMessageParam[],
  userContext: UserContext | null
): Promise<ReadableStream<string>> {
  const openai = getClient()
  const stream = await openai.chat.completions.create({
    model: CHEAP_MODEL,
    messages: [
      { role: 'system', content: buildCopyGenSystemPrompt(userContext) },
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

  const html = response.choices[0].message.content ?? ''
  // Strip any accidental markdown fences the model may have wrapped the output in
  return html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
}
