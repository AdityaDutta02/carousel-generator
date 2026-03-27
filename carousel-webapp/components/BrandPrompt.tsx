'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBrandProfile } from '@/hooks/useBrandProfile'
import type { BrandProfile } from '@/hooks/useBrandProfile'

interface BrandPromptProps {
  onDismiss?: () => void
}

export function BrandPrompt({ onDismiss }: BrandPromptProps): React.JSX.Element {
  const { profile, save, isSaving } = useBrandProfile()
  const [brandName, setBrandName] = useState(profile.brandName)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [tone, setTone] = useState<BrandProfile['tone']>(profile.tone)
  const [targetAudience, setTargetAudience] = useState(profile.targetAudience)
  const [platformPreference, setPlatformPreference] = useState<BrandProfile['platformPreference']>(
    profile.platformPreference
  )

  const [error, setError] = useState<string | null>(null)

  const handleDontAskAgain = (): void => {
    localStorage.setItem('brand_prompt_dismissed', 'true')
    onDismiss?.()
  }

  const handleSave = async (): Promise<void> => {
    setError(null)
    try {
      await save({ brandName, displayName, handle, tone, targetAudience, platformPreference })
      onDismiss?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="brand-prompt-overlay"
    >
      <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Save your brand details</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Personalise future carousels with your brand voice and style.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Brand name *</Label>
            <Input
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="Brand name (e.g. FinanceFirst)"
              className="bg-zinc-800 border-zinc-700 text-white"
              data-testid="brand-name-input"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Your name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="bg-zinc-800 border-zinc-700 text-white"
              data-testid="display-name-input"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Handle</Label>
            <Input
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="@handle"
              className="bg-zinc-800 border-zinc-700 text-white font-mono"
              data-testid="handle-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Tone</Label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as BrandProfile['tone'])}
                className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 text-white text-sm px-2"
                data-testid="tone-select"
              >
                <option value="Professional">Professional</option>
                <option value="Casual">Casual</option>
                <option value="Bold">Bold</option>
                <option value="Educational">Educational</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Platform</Label>
              <select
                value={platformPreference}
                onChange={e =>
                  setPlatformPreference(e.target.value as BrandProfile['platformPreference'])
                }
                className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 text-white text-sm px-2"
                data-testid="platform-select"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Instagram">Instagram</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">Target audience</Label>
            <Input
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              placeholder="e.g. retail investors aged 25-40"
              className="bg-zinc-800 border-zinc-700 text-white"
              data-testid="target-audience-input"
            />
          </div>
        </div>

        {error && (
          <p className="px-6 pb-2 text-red-400 text-sm" data-testid="brand-prompt-error">{error}</p>
        )}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={() => onDismiss?.()}
              data-testid="skip-button"
            >
              Skip for now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-600 hover:text-zinc-400 text-xs"
              onClick={handleDontAskAgain}
              data-testid="dont-ask-button"
            >
              Don&apos;t ask again
            </Button>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !brandName.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            size="sm"
            data-testid="save-brand-button"
          >
            {isSaving ? 'Saving\u2026' : 'Save brand'}
          </Button>
        </div>
      </div>
    </div>
  )
}
