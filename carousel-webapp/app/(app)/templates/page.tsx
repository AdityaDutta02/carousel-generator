'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { Button } from '@/components/ui/button'
import { createCarouselFromTemplate } from '@/lib/pocketbase'
import type { Template } from '@/types/template'

export default function TemplatesPage(): React.JSX.Element {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelectTemplate(t: Template): Promise<void> {
    setIsCreating(true)
    setError(null)
    try {
      const carousel = await createCarouselFromTemplate(t)
      router.push(`/builder/${carousel.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create carousel. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Templates</h1>
        <Button variant="outline" onClick={() => router.push('/templates/new')} className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
          + Create from PNG
        </Button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mb-4" data-testid="templates-error">{error}</p>
      )}
      {isCreating && (
        <p className="text-zinc-400 text-sm mb-4" data-testid="templates-creating">Creating carousel...</p>
      )}
      <TemplatePicker onSelect={handleSelectTemplate} />
    </div>
  )
}
