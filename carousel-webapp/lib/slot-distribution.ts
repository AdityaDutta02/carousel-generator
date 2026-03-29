import type { SlotDefinition } from '@/types/template'

/**
 * Distributes a flat AI-filled slot map to per-slide slot records.
 * Global slots (slide: 'all') go into every slide.
 * Per-slide slots (slide: N) go into slideSlots[N-1].
 * Slots beyond slideCount are ignored.
 */
export function distributeFilledSlots(
  filled: Record<string, string>,
  allSlots: SlotDefinition[],
  slideCount: number
): Record<string, string>[] {
  const slideSlots: Record<string, string>[] = Array.from({ length: slideCount }, () => ({}))

  for (const [id, val] of Object.entries(filled)) {
    if (!val) continue
    const slotDef = allSlots.find(s => s.id === id)
    if (!slotDef) continue

    if (slotDef.slide === 'all') {
      for (const slots of slideSlots) slots[id] = val
    } else {
      const idx = (slotDef.slide as number) - 1
      if (idx >= 0 && idx < slideSlots.length) slideSlots[idx][id] = val
    }
  }

  return slideSlots
}
