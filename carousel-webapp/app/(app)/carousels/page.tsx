'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createPocketBaseClient, getCarousels } from '@/lib/pocketbase'
import type { CarouselRecord } from '@/lib/pocketbase'

export default function CarouselsPage() {
  const [carousels, setCarousels] = useState<CarouselRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pb = createPocketBaseClient()
    getCarousels(pb)
      .then(setCarousels)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Carousels</h1>
        <Link href="/carousels/new" className={buttonVariants()}>+ New Carousel</Link>
      </div>

      {carousels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No carousels yet. Create one to get started.</p>
      ) : (
        <div className="space-y-2">
          {carousels.map(c => (
            <Link
              key={c.id}
              href={`/carousels/${c.id}`}
              className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.slide_count} slides · {c.platform}</p>
              </div>
              <Badge variant={c.status === 'published' ? 'default' : 'secondary'}>
                {c.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
