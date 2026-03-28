'use client'
import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react'
import { getCarousel, updateCarousel } from '@/lib/pocketbase'
import type { Carousel, Slide } from '@/types/carousel'

/** Builds an updated Carousel with the given slides, schedules an autosave, and returns it. */
function applySlideUpdate(
  prev: Carousel,
  slides: Slide[],
  schedule: (c: Carousel) => void
): Carousel {
  const updated = { ...prev, slides }
  schedule(updated)
  return updated
}

/**
 * Wraps a setCarousel updater: skips the update when carousel is null,
 * and applies the provided slide-transform function otherwise.
 */
function withCarousel(
  setCarousel: Dispatch<SetStateAction<Carousel | null>>,
  transform: (prev: Carousel) => Carousel
): void {
  setCarousel(prev => (prev ? transform(prev) : prev))
}

export function useCarousel(id: string): {
  carousel: Carousel | null
  isLoading: boolean
  error: string | null
  updateSlot: (slideIndex: number, slotId: string, value: string) => void
  updateGlobalSlot: (slotId: string, value: string) => void
  setCarousel: Dispatch<SetStateAction<Carousel | null>>
} {
  const [carousel, setCarousel] = useState<Carousel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getCarousel(id)
      .then(setCarousel)
      .catch(() => setError('Failed to load carousel'))
      .finally(() => setIsLoading(false))
  }, [id])

  const scheduleAutosave = useCallback((updated: Carousel): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateCarousel(updated.id, updated).catch(console.error)
    }, 1500)
  }, [])

  const updateSlot = useCallback(
    (slideIndex: number, slotId: string, value: string): void => {
      withCarousel(setCarousel, prev => {
        const slides = prev.slides.map((s, i) =>
          i !== slideIndex ? s : { ...s, slots: { ...s.slots, [slotId]: value } }
        )
        return applySlideUpdate(prev, slides, scheduleAutosave)
      })
    },
    [scheduleAutosave]
  )

  const updateGlobalSlot = useCallback(
    (slotId: string, value: string): void => {
      withCarousel(setCarousel, prev => {
        const slides = prev.slides.map(s => ({
          ...s,
          slots: { ...s.slots, [slotId]: value },
        }))
        return applySlideUpdate(prev, slides, scheduleAutosave)
      })
    },
    [scheduleAutosave]
  )

  return { carousel, isLoading, error, updateSlot, updateGlobalSlot, setCarousel }
}
