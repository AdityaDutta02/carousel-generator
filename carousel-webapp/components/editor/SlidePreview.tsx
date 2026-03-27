'use client'
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

interface SlotClickEvent {
  slotId: string
  currentValue: string
}

interface SlidePreviewProps {
  srcdoc: string
  canvasWidth: number
  canvasHeight: number
  onSlotClick: (event: SlotClickEvent) => void
  onCaptureResult: (dataUrl: string | null) => void
  scale?: number
}

export interface SlidePreviewHandle {
  capture: () => void
  sendUpdate: (slotId: string, value: string) => void
}

export const SlidePreview = forwardRef<SlidePreviewHandle, SlidePreviewProps>(
  function SlidePreview(props, ref) {
    const { srcdoc, canvasWidth, canvasHeight, onSlotClick, onCaptureResult, scale = 0.5 } = props
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const sendMessage = useCallback((msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(msg, '*')
    }, [])

    useImperativeHandle(ref, () => ({
      capture: () => sendMessage({ type: 'CAPTURE' }),
      sendUpdate: (slotId: string, value: string) =>
        sendMessage({ type: 'UPDATE_SLOT', slotId, value }),
    }))

    useEffect(() => {
      function handleMessage(e: MessageEvent) {
        if (!e.data || typeof e.data !== 'object') return
        if (e.data.type === 'SLOT_CLICK') {
          onSlotClick({ slotId: e.data.slotId, currentValue: e.data.currentValue })
        }
        if (e.data.type === 'CAPTURE_RESULT') {
          onCaptureResult(e.data.dataUrl ?? null)
        }
      }
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }, [onSlotClick, onCaptureResult])

    const displayWidth = canvasWidth * scale
    const displayHeight = canvasHeight * scale

    return (
      <div
        data-testid="slide-preview-wrapper"
        className="relative overflow-hidden rounded-xl shadow-2xl"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <iframe
          ref={iframeRef}
          title="slide-preview"
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-same-origin"
          className="absolute top-0 left-0 border-0"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    )
  }
)
