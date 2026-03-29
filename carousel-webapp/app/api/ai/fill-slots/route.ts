import { NextRequest, NextResponse } from 'next/server'
import { fillSlots } from '@/lib/openrouter'
import { verifyToken } from '@/lib/pocketbase'
import type { SlotDefinition } from '@/types/template'
import type { GeneratedCopy } from '@/types/carousel'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    slots: SlotDefinition[]
    copy: GeneratedCopy
  }
  if (!Array.isArray(body.slots) || !body.copy) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await fillSlots(body.slots, body.copy)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Slot fill failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
