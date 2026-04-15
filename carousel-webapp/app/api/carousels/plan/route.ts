// carousel-webapp/app/api/carousels/plan/route.ts
import { NextResponse } from 'next/server'
import { completion, PLAN_MODEL } from '@/lib/models'
import { buildPlanPrompt } from '@/lib/supertemplate'
import type { TemplateJson } from '@/types/template'
import type { ContentJson } from '@/types/carousel'

export async function POST(request: Request) {
  const {
    content,
    templateJson,
    slideCount,
    brand,
  }: {
    content: string
    templateJson: TemplateJson
    slideCount: number
    brand: { brand: string; platform: string }
  } = await request.json()

  if (!content || !templateJson || !slideCount || !brand?.brand) {
    return NextResponse.json({ error: 'content, templateJson, slideCount, brand required' }, { status: 400 })
  }

  const prompt = buildPlanPrompt(content, templateJson, slideCount, brand)

  const raw = await completion({
    model: PLAN_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let contentJson: ContentJson
  try {
    contentJson = JSON.parse(cleaned) as ContentJson
  } catch {
    return NextResponse.json({ error: 'Model returned invalid JSON', raw }, { status: 502 })
  }

  return NextResponse.json({ contentJson })
}
