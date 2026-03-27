'use client'
import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { Button } from '@/components/ui/button'
import type { Template } from '@/types/template'

export default function TemplatesPage() {
  const router = useRouter()
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Button variant="outline" onClick={() => router.push('/templates/new')}>
          + Create from PNG
        </Button>
      </div>
      <TemplatePicker onSelect={(t: Template) => console.log('selected', t.id)} />
    </div>
  )
}
