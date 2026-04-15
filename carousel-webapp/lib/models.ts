// carousel-webapp/lib/models.ts
// OpenRouter-based model completion client

export const VISION_MODEL = 'qwen/qwen2.5-vl-72b-instruct'
export const PLAN_MODEL = 'deepseek/deepseek-chat'
export const RENDER_MODEL = 'qwen/qwen2.5-coder-32b-instruct'

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageUrlContent {
  type: 'image_url'
  image_url: { url: string }
}

export type MessageContent = TextContent | ImageUrlContent | string

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: MessageContent | MessageContent[]
}

export interface CompletionOptions {
  model: string
  messages: Message[]
  temperature?: number
  max_tokens?: number
}

export async function completion(options: CompletionOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content in OpenRouter response')
  }

  return content
}
