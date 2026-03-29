import PocketBase from 'pocketbase'
import type { Carousel, Slide } from '@/types/carousel'

let _pb: PocketBase | null = null

export function getPocketBase(): PocketBase {
  if (!_pb) {
    _pb = new PocketBase(
      process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
    )
  }
  return _pb
}

export interface UserContext {
  brand: string
  handle: string
  audience: string
  tone: string
  platform: string
  ctaDefault: string
}

export function getUserContext(
  model: Record<string, unknown> | null
): UserContext | null {
  if (!model) return null
  return {
    brand: String(model['brand_name'] ?? ''),
    handle: String(model['handle'] ?? ''),
    audience: String(model['target_audience'] ?? ''),
    tone: String(model['tone'] ?? ''),
    platform: String(model['platform_preference'] ?? 'linkedin'),
    ctaDefault: 'Follow for more',
  }
}

// ── Carousel CRUD ──────────────────────────────────────────────────────────

export async function createCarousel(
  data: Omit<Carousel, 'id' | 'created' | 'updated'>
): Promise<Carousel> {
  const client = getPocketBase()
  const record = await client.collection('carousels').create({
    owner: data.owner,
    title: data.title,
    template_id: data.templateId || null,
    platform: data.platform,
    canvas_width: data.canvasWidth,
    canvas_height: data.canvasHeight,
    slide_count: data.slideCount,
    slides: data.slides,
    status: data.status,
  })
  return recordToCarousel(record)
}

export async function updateCarousel(
  id: string,
  data: Partial<Carousel>
): Promise<Carousel> {
  const client = getPocketBase()
  const record = await client.collection('carousels').update(id, {
    title: data.title,
    template_id: data.templateId !== undefined ? (data.templateId || null) : undefined,
    slides: data.slides,
    status: data.status,
    slide_count: data.slideCount,
    canvas_width: data.canvasWidth,
    canvas_height: data.canvasHeight,
  })
  return recordToCarousel(record)
}

export async function listCarousels(ownerId: string): Promise<Carousel[]> {
  const client = getPocketBase()
  const result = await client.collection('carousels').getList(1, 50, {
    filter: `owner = "${ownerId}"`,
    sort: '-created',
    requestKey: null,
  })
  return result.items.map(recordToCarousel)
}

export async function getCarousel(id: string): Promise<Carousel> {
  const client = getPocketBase()
  const record = await client.collection('carousels').getOne(id, { requestKey: null })
  return recordToCarousel(record)
}

function recordToCarousel(r: Record<string, unknown>): Carousel {
  return {
    id: String(r['id']),
    owner: String(r['owner']),
    title: String(r['title'] ?? ''),
    templateId: String(r['template_id'] ?? ''),
    platform: (r['platform'] as Carousel['platform']) ?? 'linkedin',
    canvasWidth: Number(r['canvas_width']) || 1080,
    canvasHeight: Number(r['canvas_height']) || 1350,
    slideCount: Number(r['slide_count']),
    slides: (r['slides'] as Slide[]) ?? [],
    status: (r['status'] as Carousel['status']) ?? 'draft',
    created: String(r['created']),
    updated: String(r['updated']),
  }
}

// Singleton instance — used by client-side code that needs direct PocketBase access
export const pb = getPocketBase()

// ── Template admin operations ───────────────────────────────────────────────

import type { Template } from '@/types/template'

/**
 * Convenience wrapper: creates a carousel from a Template, auto-populating
 * canvas dimensions, slide count, and default slides from the template.
 */
export async function createCarouselFromTemplate(
  template: Template,
  title = 'Untitled Carousel'
): Promise<Carousel> {
  const client = getPocketBase()
  const userId = client.authStore.model?.id as string | undefined
  if (!userId) throw new Error('Not authenticated')

  const slideCount = template.slideCountDefault ?? 5
  const slides: Slide[] = Array.from({ length: slideCount }, (_, i) => ({
    index: i,
    slots: {},
  }))

  return createCarousel({
    owner: userId,
    title,
    templateId: template.id,
    platform: 'linkedin',
    canvasWidth: template.canvasWidth,
    canvasHeight: template.canvasHeight,
    slideCount,
    slides,
    status: 'draft',
  })
}

export async function publishTemplate(templateId: string): Promise<Template> {
  return getPocketBase().collection('templates').update(templateId, {
    scope: 'system',
    owner: null,
  }) as Promise<Template>
}

/**
 * Verifies a PocketBase auth token server-side.
 * Returns the user record if valid, null otherwise.
 * Used in API route handlers (server-side only).
 */
export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    // Use a fresh instance so we never mutate the shared module-level singleton.
    // This instance is discarded after verification completes.
    const freshPb = new PocketBase(
      process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
    )
    freshPb.authStore.save(token, null)
    const authData = await freshPb.collection('users').authRefresh()
    return authData.record as Record<string, unknown>
  } catch {
    return null
  }
}
