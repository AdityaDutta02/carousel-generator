// carousel-webapp/app/api/templates/extract/route.ts
import { NextResponse } from 'next/server'
import { completion, VISION_MODEL, type Message } from '@/lib/models'
import { buildExtractionPrompt } from '@/lib/supertemplate'

export async function POST(request: Request) {
  const { images }: { images: string[] } = await request.json()

  if (!images || images.length === 0) {
    return NextResponse.json({ error: 'images required' }, { status: 400 })
  }

  const prompt = buildExtractionPrompt()

  const imageContents = images.map(base64 => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/png;base64,${base64}` },
  }))

  const messages: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...imageContents,
      ],
    },
  ]

  const raw = await completion({ model: VISION_MODEL, messages, temperature: 0.2 })

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let templateJson: unknown
  try {
    templateJson = JSON.parse(cleaned)
  } catch {
    return NextResponse.json(
      { error: 'Model returned invalid JSON', raw },
      { status: 502 }
    )
  }

  return NextResponse.json({ templateJson })
}
