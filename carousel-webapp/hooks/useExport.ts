'use client'
import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import type { SlidePreviewHandle } from '@/components/editor/SlidePreview'
import type React from 'react'

export function buildZipFilename(title: string): string {
  if (!title.trim()) return 'carousel.zip'
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${slug}.zip`
}

export function useExport(slideCount: number, title: string) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const exportZip = useCallback(
    async (
      previewRef: React.RefObject<SlidePreviewHandle | null>,
      onSwitchSlide: (index: number) => Promise<void>
    ): Promise<void> => {
      setIsExporting(true)
      setProgress(0)
      const zip = new JSZip()

      for (let i = 0; i < slideCount; i++) {
        await onSwitchSlide(i)
        await new Promise(r => setTimeout(r, 300))

        const dataUrl = await new Promise<string | null>(resolve => {
          const handle = previewRef.current
          if (!handle) { resolve(null); return }

          const timeout = setTimeout(() => resolve(null), 5000)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(window as any).__captureResolve = (url: string | null) => {
            clearTimeout(timeout)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__captureResolve = null
            resolve(url)
          }
          handle.capture()
        })

        if (dataUrl) {
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
          const padded = String(i + 1).padStart(2, '0')
          zip.file(`slide-${padded}.png`, base64, { base64: true })
        }
        setProgress(Math.round(((i + 1) / slideCount) * 100))
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildZipFilename(title)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setIsExporting(false)
      setProgress(0)
    },
    [slideCount, title]
  )

  return { isExporting, progress, exportZip }
}
