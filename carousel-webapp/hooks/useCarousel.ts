'use client'
import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react'
import { getCarousel, updateCarousel } from '@/lib/pocketbase'
import type { Carousel, Slide } from '@/types/carousel'

interface LoadState {
  id: string
  carousel: Carousel | null
  isLoading: boolean
  error: string | null
}

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
  const [state, setState] = useState<LoadState>({ id, carousel: null, isLoading: true, error: null })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    getCarousel(id)
      .then(carousel => {
        if (!cancelled) setState({ id, carousel, isLoading: false, error: null })
      })
      .catch(() => {
        if (!cancelled) setState({ id, carousel: null, isLoading: false, error: 'Failed to load carousel' })
      })
    return () => { cancelled = true }
  }, [id])

  const scheduleAutosave = useCallback((updated: Carousel): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateCarousel(updated.id, updated).catch(console.error)
    }, 1500)
  }, [])

  // setCarousel exposed to consumers — wraps the combined state setter
  const setCarousel: Dispatch<SetStateAction<Carousel | null>> = useCallback(
    (action) => {
      setState(prev => {
        const next = typeof action === 'function' ? action(prev.carousel) : action
        return { ...prev, carousel: next }
      })
    },
    []
  )

  const updateSlot = useCallback(
    (slideIndex: number, slotId: string, value: string): void => {
      withCarousel(setCarousel, prev => {
        const slides = prev.slides.map((s, i) =>
          i !== slideIndex ? s : { ...s, slots: { ...s.slots, [slotId]: value } }
        )
        return applySlideUpdate(prev, slides, scheduleAutosave)
      })
    },
    [setCarousel, scheduleAutosave]
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
    [setCarousel, scheduleAutosave]
  )

  const carousel = state.id === id ? state.carousel : null
  const error = state.id === id ? state.error : null
  const isLoading = state.id !== id || state.isLoading

  return { carousel, isLoading, error, updateSlot, updateGlobalSlot, setCarousel }
}
