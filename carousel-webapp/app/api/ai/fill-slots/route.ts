import { NextRequest, NextResponse } from 'next/server'
import { fillSlots } from '@/lib/openrouter'
import type { SlotDefinition } from '@/types/template'
import type { GeneratedCopy } from '@/types/carousel'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as {
    slots: SlotDefinition[]
    copy: GeneratedCopy
  }

  try {
    const result = await fillSlots(body.slots, body.copy)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Slot fill failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
