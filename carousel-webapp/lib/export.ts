// carousel-webapp/lib/export.ts
// Browser-only: uses dom-to-image-more and JSZip

export interface ExportOptions {
  iframeEl: HTMLIFrameElement
  carouselName: string
}

export async function exportCarouselAsZip({ iframeEl, carouselName }: ExportOptions): Promise<void> {
  // Dynamic imports — these are browser bundles
  const domtoimage = (await import('dom-to-image-more')).default
  const JSZip = (await import('jszip')).default

  const doc = iframeEl.contentDocument
  if (!doc) throw new Error('iframe has no contentDocument')

  const slides = Array.from(doc.querySelectorAll('.slide')) as HTMLElement[]
  if (slides.length === 0) throw new Error('No .slide elements found in iframe')

  const zip = new JSZip()

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]

    // Activate only this slide
    slides.forEach(s => s.style.display = 'none')
    slide.style.display = 'block'

    const dataUrl = await domtoimage.toPng(slide, { scale: 2 })
    const base64 = dataUrl.split(',')[1]
    const num = String(i + 1).padStart(2, '0')
    zip.file(`slide-${num}.png`, base64, { base64: true })
  }

  // Restore visibility
  slides.forEach((s, i) => {
    s.style.display = i === 0 ? 'block' : 'none'
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${carouselName}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
