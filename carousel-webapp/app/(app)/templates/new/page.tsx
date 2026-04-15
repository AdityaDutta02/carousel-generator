'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createPocketBaseClient, createTemplate } from '@/lib/pocketbase'
import type { TemplateJson } from '@/types/template'

type Step = 1 | 2 | 3

interface ImageEntry {
  file: File
  base64: string
}

interface ExtractResponse {
  templateJson?: TemplateJson
  error?: string
}

export default function NewTemplatePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [images, setImages] = useState<ImageEntry[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [name, setName] = useState('')
  const [isSystem, setIsSystem] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3)
    void Promise.all(
      files.map(
        file =>
          new Promise<ImageEntry>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              const base64 = result.split(',')[1] ?? ''
              resolve({ file, base64 })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    ).then(setImages)
  }

  async function handleExtract() {
    if (images.length === 0) return
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await fetch('/api/templates/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: images.map(i => i.base64) }),
      })
      const data = (await res.json()) as ExtractResponse
      if (!res.ok || !data.templateJson) throw new Error(data.error ?? 'Extraction failed')
      setJsonText(JSON.stringify(data.templateJson, null, 2))
      setStep(2)
    } catch (err: unknown) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      let parsedJson: TemplateJson
      try {
        parsedJson = JSON.parse(jsonText) as TemplateJson
      } catch {
        throw new Error('JSON is invalid. Fix it before saving.')
      }
      const pb = createPocketBaseClient()
      const thumbnail = images[0]?.file
      await createTemplate(pb, { name: name.trim(), template_json: parsedJson, thumbnail, is_system: isSystem })
      router.push('/templates')
    } catch (err: unknown) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const stepLabels = ['1. Upload', '2. Review', '3. Save'] as const

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">New Template</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8 text-sm">
        {stepLabels.map((label, i) => (
          <span
            key={label}
            className={`px-3 py-1 rounded-full ${
              step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload reference images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload 1-3 PNG screenshots of an existing carousel to extract its design system.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              Choose Images (max 3)
            </Button>
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(img.file)}
                    alt={`Reference image ${i + 1}`}
                    className="h-24 w-auto rounded border"
                  />
                ))}
              </div>
            )}
            {extractError && <p className="text-sm text-destructive">{extractError}</p>}
            <Button onClick={() => void handleExtract()} disabled={images.length === 0 || extracting}>
              {extracting ? 'Extracting...' : 'Extract Design System ->'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review extracted JSON</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Edit any extraction errors before saving.</p>
            <textarea
              className="w-full h-96 font-mono text-xs p-3 border rounded bg-muted resize-y"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                &larr; Back
              </Button>
              <Button onClick={() => setStep(3)}>Continue &rarr;</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Name and save</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Template name</Label>
              <Input
                id="name"
                placeholder="e.g. Editorial Dark"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSystem}
                onChange={e => setIsSystem(e.target.checked)}
              />
              Mark as system template (visible to all users)
            </label>
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                &larr; Back
              </Button>
              <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
