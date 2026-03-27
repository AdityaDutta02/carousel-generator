'use client'
import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { SchemaJson, SlotDefinition, SlotType } from '@/types/template'

interface SchemaEditorProps {
  schema: SchemaJson
  templateHtml: string
  onSchemaChange: (schema: SchemaJson) => void
}

const SLOT_TYPES: SlotType[] = ['text', 'css_var', 'font_size', 'toggle']

function detectSlotIds(html: string): string[] {
  const ids = [...html.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1])
  return [...new Set(ids)]
}

function defaultSlot(id: string): SlotDefinition {
  return {
    id,
    slide: 1,
    selector: `[data-slot='${id}']`,
    type: 'text',
    label: id.replace(/_/g, ' ').replace(/^s\d+ /, ''),
    maxChars: 80,
  }
}

export function SchemaEditor({ schema, templateHtml, onSchemaChange }: SchemaEditorProps) {
  const detectedIds = useMemo(() => detectSlotIds(templateHtml), [templateHtml])
  const definedIds = new Set(schema.slots.map(s => s.id))
  const undefinedIds = detectedIds.filter(id => !definedIds.has(id))

  const updateSlot = (index: number, updates: Partial<SlotDefinition>) => {
    const updatedSlots = schema.slots.map((slot, i) =>
      i === index ? { ...slot, ...updates } : slot
    )
    onSchemaChange({ ...schema, slots: updatedSlots })
  }

  const removeSlot = (index: number) => {
    onSchemaChange({ ...schema, slots: schema.slots.filter((_, i) => i !== index) })
  }

  const addDetected = (id: string) => {
    onSchemaChange({ ...schema, slots: [...schema.slots, defaultSlot(id)] })
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-widest">Slot Schema</p>

      {undefinedIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">Detected in HTML — not yet defined:</p>
          {undefinedIds.map(id => (
            <div key={id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
              <code className="text-xs text-orange-400">{id}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={() => addDetected(id)}
              >
                + Add
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {schema.slots.map((slot, index) => (
          <div key={slot.id} className="bg-zinc-900 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="text-xs text-zinc-500">{slot.id}</code>
                {/* Visible type badge — used by tests via screen.getAllByText */}
                <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5">
                  {slot.type}
                </span>
              </div>
              <button
                type="button"
                title="Remove slot"
                onClick={() => removeSlot(index)}
                className="text-zinc-600 hover:text-red-400 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Label</Label>
                <Input
                  value={slot.label}
                  onChange={e => updateSlot(index, { label: e.target.value })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Type</Label>
                <select
                  value={slot.type}
                  onChange={e => updateSlot(index, { type: e.target.value as SlotType })}
                  className="h-7 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 text-white"
                >
                  {SLOT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {slot.type === 'text' && (
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Max characters</Label>
                <Input
                  type="number"
                  value={slot.maxChars ?? 80}
                  onChange={e => updateSlot(index, { maxChars: Number(e.target.value) })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700 w-24"
                  min={10}
                  max={500}
                />
              </div>
            )}

            {slot.type === 'css_var' && (
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">CSS variable name</Label>
                <Input
                  value={slot.variable ?? ''}
                  onChange={e => updateSlot(index, { variable: e.target.value })}
                  className="h-7 text-xs bg-zinc-800 border-zinc-700 font-mono"
                  placeholder="--accent"
                />
              </div>
            )}

            {slot.type === 'font_size' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Min px</Label>
                  <Input
                    type="number"
                    value={slot.min ?? 12}
                    onChange={e => updateSlot(index, { min: Number(e.target.value) })}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Max px</Label>
                  <Input
                    type="number"
                    value={slot.max ?? 200}
                    onChange={e => updateSlot(index, { max: Number(e.target.value) })}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {schema.slots.length === 0 && undefinedIds.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-4">
          No data-slot attributes found in template HTML.
        </p>
      )}
    </div>
  )
}
