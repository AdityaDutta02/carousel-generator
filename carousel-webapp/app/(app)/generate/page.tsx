'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyChat } from '@/components/generate/CopyChat'
import { ScriptPreview } from '@/components/generate/ScriptPreview'
import { TemplatePicker } from '@/components/templates/TemplatePicker'
import { createCarousel } from '@/lib/pocketbase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { pb } from '@/lib/pocketbase'
import type { GeneratedCopy, Platform } from '@/types/carousel'
import type { Template } from '@/types/template'
import { distributeFilledSlots } from '@/lib/slot-distribution'

type Step = 'chat' | 'review' | 'templates'

export default function GeneratePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('chat')
  const [copy, setCopy] = useState<GeneratedCopy | null>(null)
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCopyApproved(approvedCopy: GeneratedCopy, approvedPlatform: Platform) {
    setCopy(approvedCopy)
    setPlatform(approvedPlatform)
    setStep('review')
  }

  function handleConfirmScript() {
    setStep('templates')
  }

  async function handleTemplateSelected(template: Template) {
    if (!copy || !user) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const allSlots = template.schemaJson?.slots ?? []
      const slideCount = copy.slides.length

      // Let the AI map all generated copy to the correct template slots.
      // fillSlots returns a flat {slotId: value} map covering all slides.
      let filled: Record<string, string> = {}
      if (allSlots.length > 0) {
        try {
          const res = await fetch('/api/ai/fill-slots', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${pb.authStore.token}`,
            },
            body: JSON.stringify({ slots: allSlots, copy }),
          })
          if (res.ok) {
            filled = (await res.json()) as Record<string, string>
          } else {
            console.warn('[fill-slots] non-ok response', res.status)
          }
        } catch (err) {
          console.warn('[fill-slots] failed, slides will use placeholder text', err)
        }
      }

      // Distribute flat slot map to per-slide records
      const slideSlots = distributeFilledSlots(filled, allSlots, slideCount)

      const carousel = await createCarousel({
        owner: user.id,
        title: copy.hook,
        templateId: template.id,
        platform,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
        slideCount,
        slides: slideSlots.map((slots, i) => ({ index: i, slots })),
        status: 'draft',
      })
      router.push(`/builder/${carousel.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create carousel'
      setCreateError(msg)
    } finally {
      setIsCreating(false)
    }
  }

  const stepTitle =
    step === 'chat' ? 'What are we creating today?'
    : step === 'review' ? 'Review your script'
    : 'Choose a template'

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-semibold mb-6">{stepTitle}</h1>
        {step === 'chat' && (
          <div className="max-w-2xl h-[calc(100vh-160px)]">
            <CopyChat onCopyApproved={handleCopyApproved} />
          </div>
        )}
        {step === 'review' && copy && (
          <div className="max-w-2xl">
            <ScriptPreview
              copy={copy}
              onCopyChange={setCopy}
              onConfirm={handleConfirmScript}
            />
          </div>
        )}
        {step === 'templates' && (
          <div className="max-w-5xl">
            <div className="mb-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('review')}>
                ← Back to script
              </Button>
            </div>
            {createError && (
              <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
                {createError}
              </div>
            )}
            {isCreating ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Fitting your content to the template…</p>
              </div>
            ) : (
              <TemplatePicker onSelect={handleTemplateSelected} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
