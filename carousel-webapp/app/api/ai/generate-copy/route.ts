import { NextRequest, NextResponse } from 'next/server'
import { streamCopyGeneration } from '@/lib/openrouter'
import { verifyToken } from '@/lib/pocketbase'
import type { UserContext } from '@/lib/pocketbase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userContext: UserContext = {
    brand: (user['brand_name'] as string) ?? '',
    handle: (user['handle'] as string) ?? '',
    audience: (user['target_audience'] as string) ?? '',
    tone: (user['tone'] as string) ?? 'professional',
    platform: (user['platform_preference'] as string) ?? 'linkedin',
    ctaDefault: 'Follow for more',
  }

  const body = (await req.json()) as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  let stream: ReadableStream<string>
  try {
    stream = await streamCopyGeneration(body.messages, userContext)
  } catch (err) {
    console.error('[generate-copy] OpenRouter error:', err)
    return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 })
  }

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
