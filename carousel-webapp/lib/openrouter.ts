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
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) controller.enqueue(delta)
      }
      controller.close()
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
