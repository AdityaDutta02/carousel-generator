'use client'
import { CANVAS_SIZES } from '@/types/carousel'
import { cn } from '@/lib/utils'

interface CanvasSizePickerProps {
  selected: string
  onSelect: (key: string) => void
}

export function CanvasSizePicker({ selected, onSelect }: CanvasSizePickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400 font-medium">Canvas Size</p>
      <div className="space-y-1">
        {Object.entries(CANVAS_SIZES).map(([key, size]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected === key}
              onChange={() => onSelect(key)}
              className="accent-orange-500"
            />
            <span className={cn(
              'text-sm',
              selected === key ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
            )}>
              {size.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
