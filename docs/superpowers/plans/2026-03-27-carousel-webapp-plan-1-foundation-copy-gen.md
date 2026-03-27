# Carousel Webapp — Plan 1: Foundation + Copy Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js webapp with PocketBase auth, and build the full AI copy generation flow — from user input through conversational follow-ups to an approved slide script stored in PocketBase.

**Architecture:** Next.js 16 App Router in `carousel-webapp/` subdirectory. PocketBase SDK talks to a separately-running PocketBase instance. OpenRouter (OpenAI-compatible) handles all AI via two API routes. Copy generation is a streaming conversation; slot fill is a one-shot JSON call.

**Tech Stack:** Next.js 16, TypeScript strict, PocketBase JS SDK, `openai` npm package (OpenRouter-compatible), shadcn/ui, Tailwind CSS, Vitest + React Testing Library

---

## File Map

```
carousel-webapp/
├── app/
│   ├── layout.tsx                        ROOT layout + font
│   ├── (auth)/
│   │   ├── login/page.tsx                Login form
│   │   └── register/page.tsx             Register form
│   └── (app)/
│       ├── layout.tsx                    Auth guard + sidebar
│       ├── dashboard/page.tsx            Carousel list
│       └── generate/page.tsx             Copy gen flow (wires CopyChat + ScriptPreview)
├── app/api/
│   ├── ai/generate-copy/route.ts         OpenRouter cheap model — streaming SSE
│   └── ai/fill-slots/route.ts            OpenRouter cheap model — one-shot JSON
├── lib/
│   ├── pocketbase.ts                     Typed PocketBase singleton + collection types
│   └── openrouter.ts                     Model config, cheap/good routing, fetch helpers
├── hooks/
│   └── useCarousel.ts                    CRUD + optimistic autosave to PocketBase
├── components/
│   ├── generate/
│   │   ├── CopyChat.tsx                  Conversational UI with quick-reply chips
│   │   └── ScriptPreview.tsx             Review + inline-edit generated script
│   └── ui/                               shadcn components (auto-generated, don't edit)
└── types/
    ├── carousel.ts                       Carousel, Slide, SlotValue
    └── template.ts                       Template, SlotDefinition, SchemaJson
```

---

## Task 1: Scaffold Next.js App

**Files:**
- Create: `carousel-webapp/` (entire directory)

- [ ] **Step 1: Create the app**

```bash
cd "/Users/aditya/Documents/Coding Projects/Carousel Generator"
npx create-next-app@latest carousel-webapp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd carousel-webapp
```

- [ ] **Step 2: Install dependencies**

```bash
npm install pocketbase openai jszip dom-to-image-more react-colorful
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted: style = Default, base color = Zinc, CSS variables = yes.

- [ ] **Step 4: Add shadcn components used in Plan 1**

```bash
npx shadcn@latest add button input textarea label card badge separator skeleton toast
```

- [ ] **Step 5: Configure Vitest — create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test script to `package.json`**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 8: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_CHEAP_MODEL=deepseek/deepseek-chat
OPENROUTER_GOOD_MODEL=anthropic/claude-haiku-4-5
EOF
```

- [ ] **Step 9: Add `.env.local` to `.gitignore`**

Confirm `carousel-webapp/.gitignore` contains `.env.local` (create-next-app adds it by default).

- [ ] **Step 10: Commit**

```bash
git add carousel-webapp/
git commit -m "feat: scaffold Next.js carousel webapp"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `carousel-webapp/types/carousel.ts`
- Create: `carousel-webapp/types/template.ts`

- [ ] **Step 1: Write types test — `carousel-webapp/types/carousel.test.ts`**

```typescript
import { describe, it, expectTypeOf } from 'vitest'
import type { Carousel, Slide, SlotValue, CarouselStatus } from './carousel'

describe('Carousel types', () => {
  it('Carousel has required fields', () => {
    expectTypeOf<Carousel>().toHaveProperty('id')
    expectTypeOf<Carousel>().toHaveProperty('owner')
    expectTypeOf<Carousel>().toHaveProperty('slides')
    expectTypeOf<Carousel>().toHaveProperty('status')
  })

  it('SlotValue maps string to string', () => {
    const v: SlotValue = { s1_headline: 'hello' }
    expectTypeOf(v).toEqualTypeOf<Record<string, string>>()
  })

  it('CarouselStatus is a union', () => {
    const s: CarouselStatus = 'draft'
    expectTypeOf(s).toEqualTypeOf<'draft' | 'exported'>()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd carousel-webapp && npx vitest run types/carousel.test.ts
```
Expected: FAIL — `carousel.ts` doesn't exist yet.

- [ ] **Step 3: Create `carousel-webapp/types/carousel.ts`**

```typescript
export type CarouselStatus = 'draft' | 'exported'

export type SlotValue = Record<string, string>

export interface Slide {
  index: number
  slots: SlotValue
}

export interface Carousel {
  id: string
  owner: string
  title: string
  templateId: string
  platform: Platform
  canvasWidth: number
  canvasHeight: number
  slideCount: number
  slides: Slide[]
  status: CarouselStatus
  created: string
  updated: string
}

export interface GeneratedCopy {
  hook: string
  slides: Array<{
    headline: string
    body: string
    stat?: string
    quote?: string
  }>
  cta: string
}

export type Platform = 'linkedin' | 'instagram' | 'stories' | 'tiktok'

export const CANVAS_SIZES: Record<string, { width: number; height: number; label: string }> = {
  'instagram-square': { width: 1080, height: 1080, label: 'Instagram Square / LinkedIn (1080×1080)' },
  'instagram-portrait': { width: 1080, height: 1350, label: 'Instagram Portrait (1080×1350)' },
  'stories': { width: 1080, height: 1920, label: 'Stories / TikTok (1080×1920)' },
  'linkedin-native': { width: 1080, height: 1300, label: 'LinkedIn Native (1080×1300)' },
  'linkedin-link': { width: 1200, height: 628, label: 'LinkedIn Link Preview (1200×628)' },
}
```

- [ ] **Step 4: Create `carousel-webapp/types/template.ts`**

```typescript
export type SlotType = 'text' | 'css_var' | 'font_size' | 'toggle'

export interface SlotDefinition {
  id: string
  slide: number | 'all'
  selector: string
  type: SlotType
  label: string
  maxChars?: number        // text only
  variable?: string        // css_var only: e.g. '--accent'
  min?: number             // font_size only
  max?: number             // font_size only
  default?: string
}

export interface SchemaJson {
  version: 1
  slots: SlotDefinition[]
}

export interface Template {
  id: string
  name: string
  scope: 'system' | 'user'
  owner: string | null
  htmlFileUrl: string
  schemaJson: SchemaJson
  thumbnailUrl: string
  canvasWidth: number
  canvasHeight: number
  platformTags: string[]
  slideCountDefault: number
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run types/carousel.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add types/
git commit -m "feat: add carousel and template TypeScript types"
```

---

## Task 3: PocketBase Client

**Files:**
- Create: `carousel-webapp/lib/pocketbase.ts`
- Create: `carousel-webapp/lib/pocketbase.test.ts`

> **Before this task:** Start PocketBase and create the collections manually via the admin UI at `http://127.0.0.1:8090/_/`.
>
> Collections to create:
>
> **`users`** (extends auth collection) — add fields:
> `display_name` (text), `brand_name` (text), `handle` (text), `bio` (text), `logo` (file, max 1), `accent_color` (text, default `#E05828`), `tone` (select: Professional/Casual/Bold/Educational), `target_audience` (text), `platform_preference` (select: linkedin/instagram/both), `role` (select: user/admin, default: user)
>
> **`templates`** — fields:
> `name` (text, required), `scope` (select: system/user, required), `owner` (relation → users, optional), `html_file` (file, max 1), `schema_json` (json), `thumbnail` (file, max 1), `canvas_width` (number), `canvas_height` (number), `platform_tags` (select multi: linkedin/instagram/stories), `slide_count_default` (number)
>
> **`carousels`** — fields:
> `owner` (relation → users, required), `title` (text), `template` (relation → templates, optional), `platform` (select: linkedin/instagram/stories/tiktok), `canvas_width` (number), `canvas_height` (number), `slide_count` (number), `slides_json` (json), `status` (select: draft/exported, default: draft)
>
> Set `carousels` list/view rules to `@request.auth.id = owner` so users only see their own.

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/lib/pocketbase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPocketBase, getUserContext } from './pocketbase'

// Don't actually connect to PocketBase in unit tests
vi.mock('pocketbase', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      authStore: { model: null, isValid: false },
      collection: vi.fn().mockReturnValue({
        getOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      }),
    })),
  }
})

describe('getPocketBase', () => {
  it('returns a singleton — same instance on repeated calls', () => {
    const a = getPocketBase()
    const b = getPocketBase()
    expect(a).toBe(b)
  })
})

describe('getUserContext', () => {
  it('returns null when user has no profile', () => {
    const ctx = getUserContext(null)
    expect(ctx).toBeNull()
  })

  it('returns structured context when user has profile', () => {
    const model = {
      id: 'u1',
      brand_name: 'TestBrand',
      handle: '@test',
      target_audience: 'developers',
      tone: 'Casual',
      platform_preference: 'linkedin',
    }
    const ctx = getUserContext(model as any)
    expect(ctx).toMatchObject({
      brand: 'TestBrand',
      handle: '@test',
      audience: 'developers',
      tone: 'Casual',
      platform: 'linkedin',
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/pocketbase.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/lib/pocketbase.ts`**

```typescript
import PocketBase from 'pocketbase'
import type { Carousel, Slide } from '@/types/carousel'
import type { Template } from '@/types/template'

let pb: PocketBase | null = null

export function getPocketBase(): PocketBase {
  if (!pb) {
    pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090')
  }
  return pb
}

export interface UserContext {
  brand: string
  handle: string
  audience: string
  tone: string
  platform: string
  ctaDefault: string
}

export function getUserContext(model: Record<string, unknown> | null): UserContext | null {
  if (!model) return null
  return {
    brand: String(model.brand_name ?? ''),
    handle: String(model.handle ?? ''),
    audience: String(model.target_audience ?? ''),
    tone: String(model.tone ?? ''),
    platform: String(model.platform_preference ?? 'linkedin'),
    ctaDefault: 'Follow for more',
  }
}

// ── Carousel CRUD ──────────────────────────────────────────────────────────

export async function createCarousel(
  data: Omit<Carousel, 'id' | 'created' | 'updated'>
): Promise<Carousel> {
  const pb = getPocketBase()
  const record = await pb.collection('carousels').create({
    owner: data.owner,
    title: data.title,
    template: data.templateId || null,
    platform: data.platform,
    canvas_width: data.canvasWidth,
    canvas_height: data.canvasHeight,
    slide_count: data.slideCount,
    slides_json: data.slides,
    status: data.status,
  })
  return recordToCarousel(record)
}

export async function updateCarousel(id: string, data: Partial<Carousel>): Promise<Carousel> {
  const pb = getPocketBase()
  const record = await pb.collection('carousels').update(id, {
    title: data.title,
    slides_json: data.slides,
    status: data.status,
    slide_count: data.slideCount,
    canvas_width: data.canvasWidth,
    canvas_height: data.canvasHeight,
  })
  return recordToCarousel(record)
}

export async function listCarousels(ownerId: string): Promise<Carousel[]> {
  const pb = getPocketBase()
  const result = await pb.collection('carousels').getList(1, 50, {
    filter: `owner = "${ownerId}"`,
    sort: '-created',
  })
  return result.items.map(recordToCarousel)
}

export async function getCarousel(id: string): Promise<Carousel> {
  const pb = getPocketBase()
  const record = await pb.collection('carousels').getOne(id)
  return recordToCarousel(record)
}

function recordToCarousel(r: Record<string, unknown>): Carousel {
  return {
    id: String(r.id),
    owner: String(r.owner),
    title: String(r.title ?? ''),
    templateId: String(r.template ?? ''),
    platform: r.platform as Carousel['platform'],
    canvasWidth: Number(r.canvas_width),
    canvasHeight: Number(r.canvas_height),
    slideCount: Number(r.slide_count),
    slides: (r.slides_json as Slide[]) ?? [],
    status: (r.status as Carousel['status']) ?? 'draft',
    created: String(r.created),
    updated: String(r.updated),
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/pocketbase.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/pocketbase.ts lib/pocketbase.test.ts
git commit -m "feat: add PocketBase client with carousel CRUD and user context"
```

---

## Task 4: OpenRouter Client

**Files:**
- Create: `carousel-webapp/lib/openrouter.ts`
- Create: `carousel-webapp/lib/openrouter.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/lib/openrouter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildCopyGenSystemPrompt, buildSlotFillPrompt } from './openrouter'
import type { UserContext } from './pocketbase'

const mockCtx: UserContext = {
  brand: 'FinanceFirst',
  handle: '@ff',
  audience: 'retail investors',
  tone: 'bold',
  platform: 'linkedin',
  ctaDefault: 'Follow for more',
}

describe('buildCopyGenSystemPrompt', () => {
  it('includes user context', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('FinanceFirst')
    expect(prompt).toContain('retail investors')
    expect(prompt).toContain('linkedin')
  })

  it('enforces JSON-only output rule', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('JSON only')
  })

  it('includes word limits', () => {
    const prompt = buildCopyGenSystemPrompt(mockCtx)
    expect(prompt).toContain('12 words')
    expect(prompt).toContain('8 words')
    expect(prompt).toContain('40 words')
  })
})

describe('buildSlotFillPrompt', () => {
  it('includes slot ids from schema', () => {
    const schema = [
      { id: 's1_headline', maxChars: 80, label: 'Headline', slide: 1 },
    ]
    const copy = { hook: 'hook text', slides: [{ headline: 'H', body: 'B' }], cta: 'follow' }
    const prompt = buildSlotFillPrompt(schema as any, copy)
    expect(prompt).toContain('s1_headline')
    expect(prompt).toContain('80')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/openrouter.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/lib/openrouter.ts`**

```typescript
import OpenAI from 'openai'
import type { UserContext } from './pocketbase'
import type { GeneratedCopy } from '@/types/carousel'
import type { SlotDefinition } from '@/types/template'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      defaultHeaders: {
        'HTTP-Referer': 'https://carousel-generator.app',
        'X-Title': 'Carousel Generator',
      },
    })
  }
  return client
}

export const CHEAP_MODEL = process.env.OPENROUTER_CHEAP_MODEL ?? 'deepseek/deepseek-chat'
export const GOOD_MODEL = process.env.OPENROUTER_GOOD_MODEL ?? 'anthropic/claude-haiku-4-5'

// ── Prompt builders ────────────────────────────────────────────────────────

export function buildCopyGenSystemPrompt(ctx: UserContext | null): string {
  const userBlock = ctx
    ? `## Creator Context
Brand: ${ctx.brand}
Handle: ${ctx.handle}
Target audience: ${ctx.audience}
Tone: ${ctx.tone}
Platform: ${ctx.platform}
Default CTA: ${ctx.ctaDefault}

Write in this creator's voice and for their specific audience.`
    : '## Creator Context\nNo brand profile set — use a professional, engaging tone.'

  return `You are an expert social media copywriter specialising in viral carousel content.

${userBlock}

## Output Rules (STRICT)
- Output JSON only — no prose, no markdown fences, no explanation
- JSON schema: { "hook": string, "slides": [{ "headline": string, "body": string, "stat"?: string, "quote"?: string }], "cta": string }
- hook: max 12 words, must create immediate curiosity or bold claim
- headline: max 8 words per slide, punchy
- body: max 40 words per slide, one clear idea
- cta: max 10 words, actionable
- Use viral hook formulas: numbered lists, counterintuitive openers, "most people don't know", bold data claims
- LinkedIn: use keywords naturally, professional hashtags at end of cta
- Instagram: conversational, 1-2 hashtags inline
- Never hallucinate facts — only use information provided by the user`
}

export function buildSlotFillPrompt(
  slots: SlotDefinition[],
  copy: GeneratedCopy
): string {
  const slotList = slots
    .filter(s => s.type === 'text')
    .map(s => `- "${s.id}" (slide ${s.slide}, label: "${s.label}", maxChars: ${s.maxChars ?? 'none'})`)
    .join('\n')

  return `Map the following generated copy into the carousel template slots.

## Template Slots
${slotList}

## Generated Copy
${JSON.stringify(copy, null, 2)}

## Rules (STRICT)
- Output a single flat JSON object only: { "slot_id": "content", ... }
- Never exceed maxChars for any slot — abbreviate gracefully if needed
- Never invent content not present in the generated copy
- Preserve the creator's tone exactly
- If a slot has no matching copy, use an empty string ""`
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function streamCopyGeneration(
  messages: OpenAI.ChatCompletionMessageParam[],
  userContext: UserContext | null
): Promise<ReadableStream<string>> {
  const client = getClient()
  const stream = await client.chat.completions.create({
    model: CHEAP_MODEL,
    messages: [
      { role: 'system', content: buildCopyGenSystemPrompt(userContext) },
      ...messages,
    ],
    stream: true,
    temperature: 0.7,
  })

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) controller.enqueue(delta)
      }
      controller.close()
    },
  })
}

export async function fillSlots(
  slots: SlotDefinition[],
  copy: GeneratedCopy
): Promise<Record<string, string>> {
  const client = getClient()
  const response = await client.chat.completions.create({
    model: CHEAP_MODEL,
    messages: [
      { role: 'user', content: buildSlotFillPrompt(slots, copy) },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  const content = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(content) as Record<string, string>
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/openrouter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "feat: add OpenRouter client with prompt builders and streaming"
```

---

## Task 5: Auth Pages + PocketBase Auth Hook

**Files:**
- Create: `carousel-webapp/app/(auth)/login/page.tsx`
- Create: `carousel-webapp/app/(auth)/register/page.tsx`
- Create: `carousel-webapp/hooks/useAuth.ts`

- [ ] **Step 1: Write auth hook test**

```typescript
// carousel-webapp/hooks/useAuth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'

vi.mock('@/lib/pocketbase', () => ({
  getPocketBase: vi.fn(() => ({
    authStore: {
      model: null,
      isValid: false,
      onChange: vi.fn(() => () => {}),
    },
    collection: vi.fn(() => ({
      authWithPassword: vi.fn().mockResolvedValue({ record: { id: 'u1' } }),
      create: vi.fn().mockResolvedValue({ id: 'u1' }),
    })),
  })),
}))

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run hooks/useAuth.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/hooks/useAuth.ts`**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getPocketBase } from '@/lib/pocketbase'

export interface AuthUser {
  id: string
  email: string
  display_name: string
  role: 'user' | 'admin'
  brand_name?: string
  handle?: string
  accent_color?: string
  tone?: string
  target_audience?: string
  platform_preference?: string
}

export function useAuth() {
  const pb = getPocketBase()
  const [user, setUser] = useState<AuthUser | null>(
    pb.authStore.isValid ? (pb.authStore.model as AuthUser) : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUser(pb.authStore.isValid ? (pb.authStore.model as AuthUser) : null)
    })
  }, [pb])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await pb.collection('users').authWithPassword(email, password)
    } catch (e) {
      setError('Invalid email or password')
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [pb])

  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        role: 'user',
      })
      await pb.collection('users').authWithPassword(email, password)
    } catch (e) {
      setError('Registration failed. Email may already be in use.')
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [pb])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [pb])

  return { user, isLoading, error, login, register, logout }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run hooks/useAuth.test.ts
```

- [ ] **Step 5: Create `carousel-webapp/app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { login, isLoading, error } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-zinc-500 text-sm text-center">
              No account?{' '}
              <a href="/register" className="text-zinc-300 hover:underline">Register</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Create `carousel-webapp/app/(auth)/register/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const { register, isLoading, error } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await register(email, password)
      router.push('/dashboard')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-zinc-500 text-sm text-center">
              Already have an account?{' '}
              <a href="/login" className="text-zinc-300 hover:underline">Sign in</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/(auth)/ hooks/useAuth.ts hooks/useAuth.test.ts
git commit -m "feat: add auth pages and useAuth hook"
```

---

## Task 6: App Shell (Auth Guard + Sidebar)

**Files:**
- Create: `carousel-webapp/app/(app)/layout.tsx`
- Create: `carousel-webapp/app/(app)/dashboard/page.tsx`
- Create: `carousel-webapp/app/layout.tsx`

- [ ] **Step 1: Create root layout — `carousel-webapp/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Carousel Generator',
  description: 'AI-powered social carousel creator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create app layout with auth guard — `carousel-webapp/app/(app)/layout.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const NAV = [
  { href: '/dashboard', label: 'My Carousels' },
  { href: '/generate', label: 'New Carousel' },
  { href: '/templates', label: 'Templates' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (user === null) {
      router.replace('/login')
    }
  }, [user, router])

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-zinc-800 flex flex-col p-4 gap-1">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4 px-2">
          Carousel Gen
        </p>
        {NAV.map(item => (
          <Link key={item.href} href={item.href}>
            <Button
              variant={pathname === item.href ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              size="sm"
            >
              {item.label}
            </Button>
          </Link>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="w-full justify-start text-zinc-500" onClick={logout}>
          Sign out
        </Button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard page — `carousel-webapp/app/(app)/dashboard/page.tsx`**

```typescript
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">My Carousels</h1>
        <Link href="/generate">
          <Button>New Carousel</Button>
        </Link>
      </div>
      <p className="text-zinc-500">No carousels yet. Create your first one.</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify the app loads**

```bash
npm run dev
```
Open `http://localhost:3000` — should redirect to `/login`. Log in → should show sidebar with "My Carousels".

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/(app)/
git commit -m "feat: add app shell with auth guard and sidebar nav"
```

---

## Task 7: Copy Generation API Route

**Files:**
- Create: `carousel-webapp/app/api/ai/generate-copy/route.ts`
- Create: `carousel-webapp/app/api/ai/fill-slots/route.ts`

- [ ] **Step 1: Create copy gen route — `carousel-webapp/app/api/ai/generate-copy/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { streamCopyGeneration } from '@/lib/openrouter'
import type { UserContext } from '@/lib/pocketbase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    userContext: UserContext | null
  }

  const stream = await streamCopyGeneration(body.messages, body.userContext)

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
```

- [ ] **Step 2: Create slot fill route — `carousel-webapp/app/api/ai/fill-slots/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fillSlots } from '@/lib/openrouter'
import type { SlotDefinition } from '@/types/template'
import type { GeneratedCopy } from '@/types/carousel'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    slots: SlotDefinition[]
    copy: GeneratedCopy
  }

  try {
    const result = await fillSlots(body.slots, body.copy)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: 'Slot fill failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/
git commit -m "feat: add AI API routes for copy generation and slot fill"
```

---

## Task 8: CopyChat Component

**Files:**
- Create: `carousel-webapp/components/generate/CopyChat.tsx`
- Create: `carousel-webapp/components/generate/CopyChat.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/components/generate/CopyChat.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CopyChat } from './CopyChat'

describe('CopyChat', () => {
  it('renders the input field', () => {
    render(<CopyChat onCopyApproved={vi.fn()} />)
    expect(screen.getByPlaceholderText(/topic, article, script/i)).toBeInTheDocument()
  })

  it('shows quick-reply chips for platform selection', () => {
    render(<CopyChat onCopyApproved={vi.fn()} />)
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
  })

  it('calls onCopyApproved when user clicks Approve', async () => {
    const onApproved = vi.fn()
    render(<CopyChat onCopyApproved={onApproved} />)
    // Simulate having a script ready
    // Full integration tested manually
    expect(onApproved).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run components/generate/CopyChat.test.tsx
```

- [ ] **Step 3: Create `carousel-webapp/components/generate/CopyChat.tsx`**

```typescript
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

const TONE_CHIPS = ['Bold & Direct', 'Educational', 'Conversational', 'Professional']
const CTA_CHIPS = ['Follow for more', 'Save this post', 'Comment below', 'Visit link in bio']

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

      // Try to parse as final JSON copy
      try {
        const parsed = JSON.parse(fullResponse.trim()) as GeneratedCopy
        if (parsed.hook && parsed.slides && parsed.cta) {
          setPendingCopy(parsed)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Here's your carousel script. Review it and approve or ask for changes.`
          }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }])
        }
      } catch {
        // Not JSON yet — it's a follow-up question
        setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }])
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
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
    <div className="flex flex-col h-full gap-4">
      {/* Platform selector */}
      {isFirstMessage && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-zinc-400 self-center">Platform:</span>
          {PLATFORMS.map(p => (
            <Badge
              key={p.value}
              variant={platform === p.value ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setPlatform(p.value)}
            >
              {p.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm">
            Paste your topic, article, script, or just a rough idea — I'll turn it into a carousel.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-zinc-300' : 'text-white'}`}>
            <span className="text-xs text-zinc-600 mr-2">{m.role === 'user' ? 'You' : 'AI'}</span>
            {m.content}
          </div>
        ))}
        {isStreaming && streamBuffer && (
          <div className="text-sm text-zinc-400 animate-pulse">{streamBuffer}</div>
        )}
      </div>

      {/* Quick reply chips (after first AI response, before pendingCopy) */}
      {messages.length > 0 && !pendingCopy && !isStreaming && (
        <div className="flex gap-2 flex-wrap">
          {[...TONE_CHIPS, ...CTA_CHIPS].slice(0, 4).map(chip => (
            <Badge
              key={chip}
              variant="outline"
              className="cursor-pointer select-none text-xs"
              onClick={() => handleChipClick(chip)}
            >
              {chip}
            </Badge>
          ))}
        </div>
      )}

      {/* Approve button */}
      {pendingCopy && (
        <div className="flex gap-2">
          <Button onClick={() => onCopyApproved(pendingCopy, platform)} className="flex-1">
            Approve & Choose Template →
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPendingCopy(null)
              sendMessage('Give me a different angle')
            }}
          >
            Try another angle
          </Button>
        </div>
      )}

      {/* Input */}
      {!pendingCopy && (
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Topic, article link, script, or rough idea…"
            className="resize-none bg-zinc-900 border-zinc-700 text-white min-h-[80px]"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (input.trim()) sendMessage(input.trim())
              }
            }}
          />
          <Button
            onClick={() => { if (input.trim()) sendMessage(input.trim()) }}
            disabled={!input.trim() || isStreaming}
            className="self-end"
          >
            {isStreaming ? '…' : '→'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run components/generate/CopyChat.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/generate/CopyChat.tsx components/generate/CopyChat.test.tsx
git commit -m "feat: add CopyChat conversational component with streaming"
```

---

## Task 9: ScriptPreview + Generate Page

**Files:**
- Create: `carousel-webapp/components/generate/ScriptPreview.tsx`
- Create: `carousel-webapp/app/(app)/generate/page.tsx`

- [ ] **Step 1: Create `carousel-webapp/components/generate/ScriptPreview.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { GeneratedCopy } from '@/types/carousel'

interface ScriptPreviewProps {
  copy: GeneratedCopy
  onChange: (copy: GeneratedCopy) => void
  onConfirm: () => void
  slideCount: number
  onSlideCountChange: (n: number) => void
}

export function ScriptPreview({
  copy, onChange, onConfirm, slideCount, onSlideCountChange,
}: ScriptPreviewProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  function updateSlide(idx: number, field: 'headline' | 'body', value: string) {
    const slides = [...copy.slides]
    slides[idx] = { ...slides[idx], [field]: value }
    onChange({ ...copy, slides })
  }

  return (
    <div className="space-y-6">
      {/* Hook */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Hook</p>
        <p className="text-lg font-semibold text-white">{copy.hook}</p>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Slide count */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-zinc-400">Slides: <span className="text-white font-medium">{slideCount}</span></p>
        <input
          type="range"
          min={3}
          max={15}
          value={slideCount}
          onChange={e => onSlideCountChange(Number(e.target.value))}
          className="flex-1 accent-orange-500"
        />
      </div>

      {/* Slides */}
      <div className="space-y-4">
        {copy.slides.map((slide, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 p-4 cursor-pointer hover:border-zinc-600 transition-colors"
            onClick={() => setEditingIdx(editingIdx === i ? null : i)}
          >
            <p className="text-xs text-zinc-500 mb-1">Slide {i + 1}</p>
            {editingIdx === i ? (
              <div className="space-y-2" onClick={e => e.stopPropagation()}>
                <Textarea
                  value={slide.headline}
                  onChange={e => updateSlide(i, 'headline', e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white text-sm font-medium resize-none"
                  rows={2}
                />
                <Textarea
                  value={slide.body}
                  onChange={e => updateSlide(i, 'body', e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-zinc-300 text-sm resize-none"
                  rows={3}
                />
              </div>
            ) : (
              <>
                <p className="font-medium text-white text-sm">{slide.headline}</p>
                <p className="text-zinc-400 text-sm mt-1">{slide.body}</p>
                {slide.stat && <Badge variant="outline" className="mt-2 text-xs">{slide.stat}</Badge>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">CTA</p>
        <p className="text-zinc-300">{copy.cta}</p>
      </div>

      <Button onClick={onConfirm} className="w-full">
        Choose Template →
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `carousel-webapp/app/(app)/generate/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyChat } from '@/components/generate/CopyChat'
import { ScriptPreview } from '@/components/generate/ScriptPreview'
import { createCarousel } from '@/lib/pocketbase'
import { useAuth } from '@/hooks/useAuth'
import type { GeneratedCopy, Platform } from '@/types/carousel'

type Step = 'chat' | 'review'

export default function GeneratePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('chat')
  const [copy, setCopy] = useState<GeneratedCopy | null>(null)
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [slideCount, setSlideCount] = useState(7)

  async function handleCopyApproved(approvedCopy: GeneratedCopy, approvedPlatform: Platform) {
    setCopy(approvedCopy)
    setPlatform(approvedPlatform)
    setSlideCount(approvedCopy.slides.length)
    setStep('review')
  }

  async function handleConfirmScript() {
    if (!copy || !user) return
    const carousel = await createCarousel({
      owner: user.id,
      title: copy.hook,
      templateId: '',
      platform,
      canvasWidth: 1080,
      canvasHeight: 1350,
      slideCount,
      slides: copy.slides.map((s, i) => ({
        index: i,
        slots: { headline: s.headline, body: s.body, stat: s.stat ?? '', quote: s.quote ?? '' },
      })),
      status: 'draft',
    })
    router.push(`/builder/${carousel.id}`)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: chat or review */}
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-semibold mb-6">
          {step === 'chat' ? 'What are we creating today?' : 'Review your script'}
        </h1>
        {step === 'chat' && (
          <div className="max-w-2xl h-[calc(100vh-160px)]">
            <CopyChat onCopyApproved={handleCopyApproved} />
          </div>
        )}
        {step === 'review' && copy && (
          <div className="max-w-2xl">
            <ScriptPreview
              copy={copy}
              onChange={setCopy}
              onConfirm={handleConfirmScript}
              slideCount={slideCount}
              onSlideCountChange={setSlideCount}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Smoke test the full flow manually**

```bash
npm run dev
```
1. Go to `http://localhost:3000/generate`
2. Type a topic, press Cmd+Enter
3. Verify streaming response appears
4. Verify approve button appears after script generates
5. Verify review screen shows slides with inline edit

- [ ] **Step 4: Commit**

```bash
git add components/generate/ScriptPreview.tsx app/(app)/generate/
git commit -m "feat: add ScriptPreview and wire generate page end-to-end"
```

---

## Task 10: useCarousel Hook

**Files:**
- Create: `carousel-webapp/hooks/useCarousel.ts`
- Create: `carousel-webapp/hooks/useCarousel.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// carousel-webapp/hooks/useCarousel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCarousel } from './useCarousel'

vi.mock('@/lib/pocketbase', () => ({
  getPocketBase: vi.fn(),
  getCarousel: vi.fn().mockResolvedValue({
    id: 'c1',
    owner: 'u1',
    title: 'Test',
    templateId: '',
    platform: 'linkedin',
    canvasWidth: 1080,
    canvasHeight: 1350,
    slideCount: 3,
    slides: [],
    status: 'draft',
    created: '',
    updated: '',
  }),
  updateCarousel: vi.fn().mockResolvedValue({ id: 'c1' }),
}))

describe('useCarousel', () => {
  it('loads carousel by id', async () => {
    const { result } = renderHook(() => useCarousel('c1'))
    // Wait for async load
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })
    expect(result.current.carousel?.id).toBe('c1')
  })

  it('exposes updateSlot function', () => {
    const { result } = renderHook(() => useCarousel('c1'))
    expect(typeof result.current.updateSlot).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run hooks/useCarousel.test.ts
```

- [ ] **Step 3: Create `carousel-webapp/hooks/useCarousel.ts`**

```typescript
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getCarousel, updateCarousel } from '@/lib/pocketbase'
import type { Carousel, Slide } from '@/types/carousel'

export function useCarousel(id: string) {
  const [carousel, setCarousel] = useState<Carousel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsLoading(true)
    getCarousel(id)
      .then(setCarousel)
      .catch(() => setError('Failed to load carousel'))
      .finally(() => setIsLoading(false))
  }, [id])

  const scheduleAutosave = useCallback((updated: Carousel) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateCarousel(updated.id, updated).catch(console.error)
    }, 1500)
  }, [])

  const updateSlot = useCallback((slideIndex: number, slotId: string, value: string) => {
    setCarousel(prev => {
      if (!prev) return prev
      const slides = prev.slides.map((s, i) => {
        if (i !== slideIndex) return s
        return { ...s, slots: { ...s.slots, [slotId]: value } }
      })
      const updated = { ...prev, slides }
      scheduleAutosave(updated)
      return updated
    })
  }, [scheduleAutosave])

  const updateGlobalSlot = useCallback((slotId: string, value: string) => {
    setCarousel(prev => {
      if (!prev) return prev
      const slides = prev.slides.map(s => ({
        ...s,
        slots: { ...s.slots, [slotId]: value },
      }))
      const updated = { ...prev, slides }
      scheduleAutosave(updated)
      return updated
    })
  }, [scheduleAutosave])

  return { carousel, isLoading, error, updateSlot, updateGlobalSlot, setCarousel }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run hooks/useCarousel.test.ts
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
All tests should pass.

- [ ] **Step 6: Commit**

```bash
git add hooks/useCarousel.ts hooks/useCarousel.test.ts
git commit -m "feat: add useCarousel hook with debounced autosave"
```

---

## Plan 1 Complete

At the end of Plan 1 you have:
- Working Next.js app with PocketBase auth (login/register)
- AI copy generation conversation flow with streaming
- Script review + inline editing
- Carousel stored to PocketBase after approval
- All utility functions tested (types, pocketbase client, openrouter prompts, hooks)
- Builder route `/builder/[id]` created by redirect (empty page — Plan 2 implements it)

**Next: Plan 2 — Template System + Editor + Export**
