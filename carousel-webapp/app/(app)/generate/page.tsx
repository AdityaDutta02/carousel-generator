'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyChat } from '@/components/generate/CopyChat'
import { ScriptPreview } from '@/components/generate/ScriptPreview'
import { createCarousel } from '@/lib/pocketbase'
import { useAuth } from '@/hooks/useAuth'
import type { GeneratedCopy, Platform } from '@/types/carousel'

type Step = 'chat' | 'review'

function adjustSlides(
  slides: GeneratedCopy['slides'],
  targetCount: number
): GeneratedCopy['slides'] {
  if (slides.length === targetCount) return slides
  if (slides.length > targetCount) return slides.slice(0, targetCount)
  // Guard: empty array — pad with blank slides
  if (slides.length === 0) {
    return Array.from({ length: targetCount }, () => ({ headline: '', body: '' }))
  }
  const last = slides[slides.length - 1]
  const extras = Array.from({ length: targetCount - slides.length }, () => ({ ...last }))
  return [...slides, ...extras]
}

export default function GeneratePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('chat')
  const [copy, setCopy] = useState<GeneratedCopy | null>(null)
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [slideCount, setSlideCount] = useState(7)

  async function handleCopyApproved(approvedCopy: GeneratedCopy, approvedPlatform: Platform) {
    setCopy(approvedCopy)
    setPlatform(approvedPlatform)
    setSlideCount(approvedCopy.slides.length)
    setStep('review')
  }

  async function handleConfirmScript() {
    if (!copy || !user) return
    const carousel = await createCarousel({
      owner: user.id,
      title: copy.hook,
      templateId: '',
      platform,
      canvasWidth: 1080,
      canvasHeight: 1350,
      slideCount,
      slides: copy.slides.map((s, i) => ({
        index: i,
        slots: { headline: s.headline, body: s.body, stat: s.stat ?? '', quote: s.quote ?? '' },
      })),
      status: 'draft',
    })
    router.push(`/builder/${carousel.id}`)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-semibold mb-6">
          {step === 'chat' ? 'What are we creating today?' : 'Review your script'}
        </h1>
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
              slideCount={{
                value: slideCount,
                onChange: (n: number) => {
                  setSlideCount(n)
                  setCopy(prev => prev ? { ...prev, slides: adjustSlides(prev.slides, n) } : prev)
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
