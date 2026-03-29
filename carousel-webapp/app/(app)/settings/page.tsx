'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HexColorPicker } from 'react-colorful'
import { useBrandProfile } from '@/hooks/useBrandProfile'
import type { BrandProfile } from '@/hooks/useBrandProfile'

export default function SettingsPage(): React.JSX.Element {
  const { profile, save, isSaving } = useBrandProfile()
  const [brandName, setBrandName] = useState(profile.brandName)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [accentColor, setAccentColor] = useState(profile.accentColor)
  const [tone, setTone] = useState<BrandProfile['tone']>(profile.tone)
  const [targetAudience, setTargetAudience] = useState(profile.targetAudience)
  const [platformPreference, setPlatformPreference] = useState<BrandProfile['platformPreference']>(
    profile.platformPreference
  )
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await save({
      brandName,
      displayName,
      handle,
      accentColor,
      tone,
      targetAudience,
      platformPreference,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-6" data-testid="settings-page">
      <h1 className="text-2xl font-bold text-white mb-2">Brand Profile</h1>
      <p className="text-zinc-400 text-sm mb-8">
        These details are injected into every AI prompt to personalise your carousel copy.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6" data-testid="brand-profile-form">
        <div>
          <Label htmlFor="brandName" className="text-sm text-zinc-300 mb-2 block">
            Brand name
          </Label>
          <Input
            id="brandName"
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="e.g. FinanceFirst"
            className="bg-zinc-900 border-zinc-700 text-white"
            data-testid="settings-brand-name"
          />
        </div>

        <div>
          <Label htmlFor="displayName" className="text-sm text-zinc-300 mb-2 block">
            Your name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Aditya"
            className="bg-zinc-900 border-zinc-700 text-white"
            data-testid="settings-display-name"
          />
        </div>

        <div>
          <Label htmlFor="handle" className="text-sm text-zinc-300 mb-2 block">
            Social handle
          </Label>
          <Input
            id="handle"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="@handle"
            className="bg-zinc-900 border-zinc-700 text-white font-mono"
            data-testid="settings-handle"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-zinc-300 mb-2 block">Tone</Label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value as BrandProfile['tone'])}
              className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm px-3"
              data-testid="settings-tone"
            >
              <option value="Professional">Professional</option>
              <option value="Casual">Casual</option>
              <option value="Bold">Bold</option>
              <option value="Educational">Educational</option>
            </select>
          </div>
          <div>
            <Label className="text-sm text-zinc-300 mb-2 block">Platform</Label>
            <select
              value={platformPreference}
              onChange={e =>
                setPlatformPreference(e.target.value as BrandProfile['platformPreference'])
              }
              className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm px-3"
              data-testid="settings-platform"
            >
              <option value="LinkedIn">LinkedIn</option>
              <option value="Instagram">Instagram</option>
              <option value="Both">Both</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="targetAudience" className="text-sm text-zinc-300 mb-2 block">
            Target audience
          </Label>
          <Textarea
            id="targetAudience"
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            placeholder="e.g. retail investors aged 25-40 interested in personal finance"
            className="bg-zinc-900 border-zinc-700 text-white resize-none"
            rows={2}
            data-testid="settings-target-audience"
          />
        </div>

        <div>
          <Label className="text-sm text-zinc-300 mb-2 block">Accent colour</Label>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-md border border-zinc-700 shrink-0"
              style={{ backgroundColor: accentColor }}
              data-testid="settings-color-swatch"
            />
            <Input
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              className="w-32 bg-zinc-900 border-zinc-700 text-white font-mono text-sm"
              placeholder="#E05828"
              data-testid="settings-accent-color-hex"
            />
          </div>
          <HexColorPicker
            color={accentColor}
            onChange={setAccentColor}
            data-testid="settings-color-picker"
          />
        </div>

        <Button
          type="submit"
          disabled={isSaving}
          className="bg-orange-500 hover:bg-orange-600 text-white w-full"
          data-testid="settings-save-button"
        >
          {saved ? 'Saved!' : isSaving ? 'Saving\u2026' : 'Save Profile'}
        </Button>
      </form>
    </div>
  )
}
