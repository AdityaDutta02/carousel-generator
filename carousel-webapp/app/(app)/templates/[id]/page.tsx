'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createPocketBaseClient, getTemplate, updateTemplate, deleteTemplate } from '@/lib/pocketbase'
import type { TemplateRecord } from '@/lib/pocketbase'
import type { TemplateJson } from '@/types/template'

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [record, setRecord] = useState<TemplateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const pb = createPocketBaseClient()
    getTemplate(pb, id)
      .then(r => {
        setRecord(r)
        setName(r.name)
        setJsonText(JSON.stringify(r.template_json, null, 2))
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    if (!record) return
    setSaving(true)
    setSaveMsg(null)
    try {
      let parsedJson: TemplateJson
      try {
        parsedJson = JSON.parse(jsonText) as TemplateJson
      } catch {
        throw new Error('JSON is invalid')
      }
      const pb = createPocketBaseClient()
      await updateTemplate(pb, id, { name: name.trim(), template_json: parsedJson })
      setSaveMsg('Saved.')
    } catch (err: unknown) {
      setSaveMsg(`Error: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeleting(true)
    try {
      const pb = createPocketBaseClient()
      await deleteTemplate(pb, id)
      router.push('/templates')
    } catch (err: unknown) {
      setError(String(err))
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/templates">&larr; Templates</Link>
        </Button>
        <h1 className="text-2xl font-semibold flex-1">{record?.name}</h1>
        <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Edit the design system JSON directly.</p>
          <textarea
            className="w-full h-96 font-mono text-xs p-3 border rounded bg-muted resize-y"
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
          />
          {saveMsg && (
            <p className={`text-sm ${saveMsg.startsWith('Error') ? 'text-destructive' : 'text-green-600'}`}>
              {saveMsg}
            </p>
          )}
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
