// carousel-webapp/lib/pocketbase.ts
import PocketBase from 'pocketbase'
import type { TemplateJson } from '@/types/template'
import type { ContentJson } from '@/types/carousel'

export function getPocketBaseUrl(): string {
  return process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
}

export function createPocketBaseClient(): PocketBase {
  return new PocketBase(getPocketBaseUrl())
}

// --- Template helpers ---

export interface TemplateRecord {
  id: string
  name: string
  template_json: TemplateJson
  thumbnail: string
  is_system: boolean
  created_by: string
  created: string
  updated: string
}

export async function getTemplates(pb: PocketBase): Promise<TemplateRecord[]> {
  const records = await pb.collection('templates').getFullList<TemplateRecord>({
    sort: '-created',
  })
  return records
}

export async function getTemplate(pb: PocketBase, id: string): Promise<TemplateRecord> {
  return pb.collection('templates').getOne<TemplateRecord>(id)
}

export async function createTemplate(
  pb: PocketBase,
  data: { name: string; template_json: TemplateJson; thumbnail?: File; is_system?: boolean }
): Promise<TemplateRecord> {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('template_json', JSON.stringify(data.template_json))
  if (data.thumbnail) formData.append('thumbnail', data.thumbnail)
  if (data.is_system !== undefined) formData.append('is_system', String(data.is_system))
  return pb.collection('templates').create<TemplateRecord>(formData)
}

export async function updateTemplate(
  pb: PocketBase,
  id: string,
  data: Partial<{ name: string; template_json: TemplateJson; is_system: boolean }>
): Promise<TemplateRecord> {
  return pb.collection('templates').update<TemplateRecord>(id, data)
}

export async function deleteTemplate(pb: PocketBase, id: string): Promise<void> {
  await pb.collection('templates').delete(id)
}

// --- Carousel helpers ---

export interface CarouselRecord {
  id: string
  name: string
  template_id: string
  content_json: ContentJson
  html_cache: string
  slide_count: number
  platform: 'LinkedIn' | 'Instagram'
  status: 'draft' | 'published'
  created_by: string
  created: string
  updated: string
}

export async function getCarousels(pb: PocketBase): Promise<CarouselRecord[]> {
  return pb.collection('carousels').getFullList<CarouselRecord>({ sort: '-created' })
}

export async function getCarousel(pb: PocketBase, id: string): Promise<CarouselRecord> {
  return pb.collection('carousels').getOne<CarouselRecord>(id)
}

export async function createCarousel(
  pb: PocketBase,
  data: {
    name: string
    template_id: string
    content_json: ContentJson
    html_cache: string
    slide_count: number
    platform: 'LinkedIn' | 'Instagram'
  }
): Promise<CarouselRecord> {
  return pb.collection('carousels').create<CarouselRecord>({
    ...data,
    status: 'draft',
  })
}

export async function updateCarousel(
  pb: PocketBase,
  id: string,
  data: Partial<{ name: string; content_json: ContentJson; html_cache: string; status: string }>
): Promise<CarouselRecord> {
  return pb.collection('carousels').update<CarouselRecord>(id, data)
}
