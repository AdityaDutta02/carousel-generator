import { NextRequest } from 'next/server'
import { streamCopyGeneration } from '@/lib/openrouter'
import type { UserContext } from '@/lib/pocketbase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    userContext: UserContext | null
  }

  const stream = await streamCopyGeneration(body.messages, body.userContext)

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
