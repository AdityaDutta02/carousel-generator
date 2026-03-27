'use client'
import { cn } from '@/lib/utils'

interface SlideThumbnailsProps {
  slideCount: number
  activeIndex: number
  onSelect: (index: number) => void
}

export function SlideThumbnails({ slideCount, activeIndex, onSelect }: SlideThumbnailsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: slideCount }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex-shrink-0 w-12 h-16 rounded border-2 flex items-center justify-center text-xs font-medium transition-colors',
            activeIndex === i
              ? 'border-orange-500 text-orange-400 bg-zinc-800'
              : 'border-zinc-700 text-zinc-500 bg-zinc-900 hover:border-zinc-500'
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}
