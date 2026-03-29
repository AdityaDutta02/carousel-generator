'use client'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PngUploaderProps {
  onImagesChange: (dataUrls: string[]) => void
  maxFiles?: number
  disabled?: boolean
}

export function PngUploader({
  onImagesChange,
  maxFiles = 3,
  disabled = false,
}: PngUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const accepted = Array.from(files)
        .filter(f => f.type === 'image/png' || f.type === 'image/jpeg')
        .slice(0, maxFiles)

      const readers = accepted.map(
        file =>
          new Promise<string>(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
      )

      Promise.all(readers).then(dataUrls => {
        setPreviews(dataUrls)
        onImagesChange(dataUrls)
      })
    },
    [maxFiles, onImagesChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const removeImage = (index: number) => {
    const next = previews.filter((_, i) => i !== index)
    setPreviews(next)
    onImagesChange(next)
  }

  return (
    <div className="space-y-3">
      <div
        data-testid="png-uploader-dropzone"
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-zinc-700 hover:border-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <p className="text-zinc-400 text-sm">
          Drag &amp; drop PNG screenshots here, or click to browse
        </p>
        <p className="text-zinc-600 text-xs mt-1">
          Up to {maxFiles} images · PNG or JPG
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={e => processFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {previews.length > 0 && (
        <div className="flex gap-2 flex-wrap" data-testid="png-uploader-previews">
          {previews.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Reference ${i + 1}`}
                className="h-24 w-auto rounded border border-zinc-700 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
