'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createPocketBaseClient, getTemplates } from '@/lib/pocketbase'
import type { TemplateRecord } from '@/lib/pocketbase'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pb = createPocketBaseClient()
    getTemplates(pb)
      .then(setTemplates)
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading templates...</div>
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Link href="/templates/new" className={buttonVariants()}>+ New Template</Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map(t => (
            <Link
              key={t.id}
              href={`/templates/${t.id}`}
              className="group block border rounded-lg overflow-hidden hover:border-primary transition-colors"
            >
              <div className="aspect-[4/5] bg-muted flex items-center justify-center">
                {t.thumbnail ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/templates/${t.id}/${t.thumbnail}?thumb=300x300t`}
                    alt={t.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-muted-foreground">IMG</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">{t.name}</p>
                {t.is_system && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    System
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
