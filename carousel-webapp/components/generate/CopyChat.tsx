'use client'
import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { GeneratedCopy, Platform } from '@/types/carousel'
import { useAuth } from '@/hooks/useAuth'
import { getUserContext } from '@/lib/pocketbase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'stories', label: 'Stories' },
]

const QUICK_CHIPS = ['Bold & Direct', 'Educational', 'Follow for more', 'Save this post']

interface CopyChatProps {
  onCopyApproved: (copy: GeneratedCopy, platform: Platform) => void
}

export function CopyChat({ onCopyApproved }: CopyChatProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingCopy, setPendingCopy] = useState<GeneratedCopy | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // PocketBase AuthRecord is not compatible with our AuthUser interface at the
  // type level, but the runtime shape is identical — getUserContext only reads
  // plain string fields that both shapes carry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userContext = getUserContext(user as any)

  const sendMessage = useCallback(async (content: string) => {
    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)
    setStreamBuffer('')

    abortRef.current = new AbortController()
    let fullResponse = ''

    try {
      const res = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, userContext }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullResponse += chunk
        setStreamBuffer(prev => prev + chunk)
      }

      try {
        const parsed = JSON.parse(fullResponse.trim()) as GeneratedCopy
        if (parsed.hook && parsed.slides && parsed.cta) {
          setPendingCopy(parsed)
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: "Here's your carousel script. Review it and approve or ask for changes.",
            },
          ])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }])
        }
      } catch {
        // Response is plain text (a follow-up question from the AI), not a GeneratedCopy JSON blob
        setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }])
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Please try again.' },
        ])
      }
    } finally {
      setIsStreaming(false)
      setStreamBuffer('')
    }
  }, [messages, userContext])

  function handleChipClick(chip: string) {
    sendMessage(chip)
  }

  const isFirstMessage = messages.length === 0

  return (
    <div className="flex flex-col h-full gap-4" data-testid="copy-chat">
      {isFirstMessage && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-zinc-400 self-center">Platform:</span>
          {PLATFORMS.map(p => (
            <Badge
              key={p.value}
              variant={platform === p.value ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setPlatform(p.value)}
              data-testid={`platform-badge-${p.value}`}
            >
              {p.label}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm">
            Paste your topic, article, script, or just a rough idea — I&apos;ll turn it into a
            carousel.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${m.role === 'user' ? 'text-zinc-300' : 'text-white'}`}
            data-testid={`message-${m.role}`}
          >
            <span className="text-xs text-zinc-600 mr-2">{m.role === 'user' ? 'You' : 'AI'}</span>
            {m.content}
          </div>
        ))}
        {isStreaming && streamBuffer && (
          <div className="text-sm text-zinc-400 animate-pulse" data-testid="stream-buffer">
            {streamBuffer}
          </div>
        )}
      </div>

      {messages.length > 0 && !pendingCopy && !isStreaming && (
        <div className="flex gap-2 flex-wrap">
          {QUICK_CHIPS.map(chip => (
            <Badge
              key={chip}
              variant="outline"
              className="cursor-pointer select-none text-xs"
              onClick={() => handleChipClick(chip)}
              data-testid={`quick-chip-${chip.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {chip}
            </Badge>
          ))}
        </div>
      )}

      {pendingCopy && (
        <div className="flex gap-2" data-testid="copy-approval-bar">
          <Button
            onClick={() => onCopyApproved(pendingCopy, platform)}
            className="flex-1"
            data-testid="approve-copy-btn"
          >
            Approve &amp; Choose Template →
          </Button>
          <Button
            variant="outline"
            data-testid="try-another-angle-btn"
            onClick={() => {
              setPendingCopy(null)
              sendMessage('Give me a different angle')
            }}
          >
            Try another angle
          </Button>
        </div>
      )}

      {!pendingCopy && (
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Topic, article link, script, or rough idea…"
            className="resize-none bg-zinc-900 border-zinc-700 text-white min-h-[80px]"
            data-testid="copy-chat-input"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (input.trim()) sendMessage(input.trim())
              }
            }}
          />
          <Button
            onClick={() => {
              if (input.trim()) sendMessage(input.trim())
            }}
            disabled={!input.trim() || isStreaming}
            className="self-end"
            data-testid="send-btn"
          >
            {isStreaming ? '…' : '→'}
          </Button>
        </div>
      )}
    </div>
  )
}
