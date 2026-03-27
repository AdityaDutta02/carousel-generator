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
    template: data.templateId || null,
    platform: data.platform,
    canvas_width: data.canvasWidth,
    canvas_height: data.canvasHeight,
    slide_count: data.slideCount,
    slides_json: data.slides,
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
    slides_json: data.slides,
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
  })
  return result.items.map(recordToCarousel)
}

export async function getCarousel(id: string): Promise<Carousel> {
  const client = getPocketBase()
  const record = await client.collection('carousels').getOne(id)
  return recordToCarousel(record)
}

function recordToCarousel(r: Record<string, unknown>): Carousel {
  return {
    id: String(r['id']),
    owner: String(r['owner']),
    title: String(r['title'] ?? ''),
    templateId: String(r['template'] ?? ''),
    platform: r['platform'] as Carousel['platform'],
    canvasWidth: Number(r['canvas_width']),
    canvasHeight: Number(r['canvas_height']),
    slideCount: Number(r['slide_count']),
    slides: (r['slides_json'] as Slide[]) ?? [],
    status: (r['status'] as Carousel['status']) ?? 'draft',
    created: String(r['created']),
    updated: String(r['updated']),
  }
}

// Singleton instance — used by client-side code that needs direct PocketBase access
export const pb = getPocketBase()
