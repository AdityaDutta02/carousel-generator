import { NextRequest, NextResponse } from 'next/server'
import PocketBase from 'pocketbase'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090')

  // Forward the user's auth token so user-scoped templates are accessible
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token) pb.authStore.save(token, null)

  try {
    const template = await pb.collection('templates').getOne(id)
    const fileUrl = pb.files.getURL(template, template.html_file as string)
    const res = await fetch(fileUrl)
    if (!res.ok) {
      return new NextResponse('Template file not found', { status: 404 })
    }
    const html = await res.text()

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new NextResponse('Template not found', { status: 404 })
  }
}
