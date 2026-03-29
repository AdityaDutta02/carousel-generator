'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPocketBase, listCarousels } from '@/lib/pocketbase'
import type { Carousel } from '@/types/carousel'

function CarouselCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-3/4 bg-zinc-800" />
      <Skeleton className="h-4 w-1/4 bg-zinc-800" />
      <Skeleton className="h-9 w-20 bg-zinc-800 mt-auto" />
    </div>
  )
}

function CarouselCard({ carousel }: { carousel: Carousel }): React.JSX.Element {
  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3 hover:border-zinc-600 transition-colors"
      data-testid="carousel-card"
    >
      <p className="font-medium text-zinc-100 truncate">{carousel.title}</p>
      <p className="text-sm text-zinc-500">
        {carousel.slideCount} slide{carousel.slideCount !== 1 ? 's' : ''}
      </p>
      <div className="mt-auto">
        <Link href={`/builder/${carousel.id}`}>
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
            Edit
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function DashboardPage(): React.JSX.Element {
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pb = getPocketBase()
    const user = pb.authStore.model
    if (!user) {
      setLoading(false)
      return
    }
    listCarousels(user.id as string)
      .then(setCarousels)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load carousels.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">My Carousels</h1>
        <Link href="/generate">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="new-carousel-btn">
            New Carousel
          </Button>
        </Link>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4" data-testid="dashboard-error">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CarouselCardSkeleton key={i} />
          ))}
        </div>
      ) : carousels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center" data-testid="empty-state">
          <p className="text-zinc-400">No carousels yet. Pick a template to get started.</p>
          <Link href="/templates">
            <Button variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
              Browse Templates
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carousels.map(c => (
            <CarouselCard key={c.id} carousel={c} />
          ))}
        </div>
      )}
    </div>
  )
}
