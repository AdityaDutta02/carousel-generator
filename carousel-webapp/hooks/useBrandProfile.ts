'use client'
import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'

export interface BrandProfile {
  displayName: string
  brandName: string
  handle: string
  accentColor: string
  tone: 'Professional' | 'Casual' | 'Bold' | 'Educational'
  targetAudience: string
  platformPreference: 'LinkedIn' | 'Instagram' | 'Both'
}

type PbModel = Record<string, unknown>

function modelToProfile(model: PbModel): BrandProfile {
  return {
    displayName: (model.display_name as string) ?? '',
    brandName: (model.brand_name as string) ?? '',
    handle: (model.handle as string) ?? '',
    accentColor: (model.accent_color as string) ?? '#E05828',
    tone: (model.tone as BrandProfile['tone']) ?? 'Professional',
    targetAudience: (model.target_audience as string) ?? '',
    platformPreference:
      (model.platform_preference as BrandProfile['platformPreference']) ?? 'LinkedIn',
  }
}

function emptyProfile(): BrandProfile {
  return modelToProfile({})
}

export function useBrandProfile(): {
  profile: BrandProfile
  isFilled: boolean
  save: (updates: Partial<BrandProfile>) => Promise<void>
  isSaving: boolean
} {
  const [profile, setProfile] = useState<BrandProfile>(() =>
    pb.authStore.model ? modelToProfile(pb.authStore.model as PbModel) : emptyProfile()
  )
  const [isSaving, setIsSaving] = useState(false)

  const isFilled = profile.brandName.trim().length > 0

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.model) {
        setProfile(modelToProfile(pb.authStore.model as PbModel))
      }
    })
    return () => unsub()
  }, [])

  const save = useCallback(async (updates: Partial<BrandProfile>): Promise<void> => {
    const userId = (pb.authStore.model as PbModel | null)?.id as string | undefined
    if (!userId) throw new Error('Not authenticated')

    const data: PbModel = {}
    if (updates.displayName !== undefined) data.display_name = updates.displayName
    if (updates.brandName !== undefined) data.brand_name = updates.brandName
    if (updates.handle !== undefined) data.handle = updates.handle
    if (updates.accentColor !== undefined) data.accent_color = updates.accentColor
    if (updates.tone !== undefined) data.tone = updates.tone
    if (updates.targetAudience !== undefined) data.target_audience = updates.targetAudience
    if (updates.platformPreference !== undefined) data.platform_preference = updates.platformPreference

    setIsSaving(true)
    try {
      const updated = await pb.collection('users').update(userId, data)
      setProfile(modelToProfile(updated as unknown as PbModel))
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { profile, isFilled, save, isSaving }
}
