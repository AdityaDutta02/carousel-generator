import { NextRequest, NextResponse } from 'next/server'
import { generateTemplate } from '@/lib/openrouter'
import { verifyToken } from '@/lib/pocketbase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { images?: unknown; description?: unknown }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
  }

  if (body.images.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 reference images allowed' }, { status: 400 })
  }

  const images = body.images as string[]
  for (const img of images) {
    if (typeof img !== 'string' || !img.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Images must be base64 data URLs (data:image/...)' },
        { status: 400 }
      )
    }
  }

  const description = typeof body.description === 'string' ? body.description : undefined

  try {
    const html = await generateTemplate(images, description)
    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Template generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
