'use client'
import { HexColorPicker } from 'react-colorful'
import { Textarea } from '@/components/ui/textarea'
import type { SlotDefinition } from '@/types/template'

interface PropertyPanelProps {
  activeSlot: SlotDefinition | null
  currentValue: string
  onChange: (value: string) => void
}

function TextControl({ slot, value, onChange }: {
  slot: SlotDefinition
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  const isNearLimit = slot.maxChars != null && value.length > slot.maxChars * 0.9
  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-900 border-zinc-700 text-white text-sm resize-none"
        rows={4}
        maxLength={slot.maxChars}
      />
      {slot.maxChars != null && (
        <p className={`text-xs text-right ${isNearLimit ? 'text-orange-400' : 'text-zinc-500'}`}>
          {value.length} / {slot.maxChars}
        </p>
      )}
    </div>
  )
}

function ColorControl({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <HexColorPicker color={value || '#E05828'} onChange={onChange} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono"
        placeholder="#E05828"
      />
    </div>
  )
}

function FontSizeControl({ slot, value, onChange }: {
  slot: SlotDefinition
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  const min = slot.min ?? 12
  const max = slot.max ?? 200
  const numericValue = Number(value) || min
  return (
    <div className="space-y-2">
      <input
        type="range"
        min={min}
        max={max}
        value={numericValue}
        onChange={e => onChange(e.target.value)}
        className="w-full accent-orange-500"
      />
      <p className="text-sm text-zinc-300 text-center">{value || min}px</p>
    </div>
  )
}

function ToggleControl({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  const isOn = value === 'true'
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`w-10 h-6 rounded-full transition-colors ${isOn ? 'bg-orange-500' : 'bg-zinc-700'} relative`}
        onClick={() => onChange(isOn ? 'false' : 'true')}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
      <span className="text-sm text-zinc-300">{isOn ? 'Visible' : 'Hidden'}</span>
    </label>
  )
}

function renderControl(
  slot: SlotDefinition,
  value: string,
  onChange: (v: string) => void
): React.ReactElement {
  if (slot.type === 'text') return <TextControl slot={slot} value={value} onChange={onChange} />
  if (slot.type === 'css_var') return <ColorControl value={value} onChange={onChange} />
  if (slot.type === 'font_size') return <FontSizeControl slot={slot} value={value} onChange={onChange} />
  return <ToggleControl value={value} onChange={onChange} />
}

export function PropertyPanel({ activeSlot, currentValue, onChange }: PropertyPanelProps): React.ReactElement | null {
  if (!activeSlot) return null

  return (
    <div className="p-4 space-y-4 border-l border-zinc-800 w-72 bg-zinc-950">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
          {activeSlot.label}
        </p>
        {renderControl(activeSlot, currentValue, onChange)}
      </div>
    </div>
  )
}
