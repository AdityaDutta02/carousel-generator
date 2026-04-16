// carousel-webapp/app/api/carousels/render/route.ts
import { NextResponse } from 'next/server'
import { completion, RENDER_MODEL } from '@/lib/models'
import { buildRenderPrompt } from '@/lib/supertemplate'
import type { TemplateJson } from '@/types/template'
import type { ContentJson } from '@/types/carousel'

export async function POST(request: Request) {
  const {
    contentJson,
    templateJson,
  }: {
    contentJson: ContentJson
    templateJson: TemplateJson
  } = await request.json()

  if (!contentJson || !templateJson) {
    return NextResponse.json({ error: 'contentJson and templateJson required' }, { status: 400 })
  }

  const prompt = buildRenderPrompt(templateJson, contentJson)

  const raw = await completion({
    model: RENDER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 16000,
  })

  // Strip markdown fences if present
  const html = raw
    .replace(/^```(?:html)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  return NextResponse.json({ html })
}
