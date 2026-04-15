// carousel-webapp/lib/models.ts

export const VISION_MODEL = process.env.VISION_MODEL ?? 'qwen/qwen2.5-vl-72b-instruct'
export const PLAN_MODEL   = process.env.PLAN_MODEL   ?? 'deepseek/deepseek-chat'
export const RENDER_MODEL = process.env.RENDER_MODEL ?? 'qwen/qwen2.5-coder-32b-instruct'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContent[]
}

export interface MessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface CompletionOptions {
  model: string
  messages: Message[]
  temperature?: number
  max_tokens?: number
}

export async function completion(options: CompletionOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://carousel-generator.app',
      'X-Title': 'Carousel Generator',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${text}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}
