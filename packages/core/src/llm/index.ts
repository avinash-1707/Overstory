// LLM access via OpenRouter (OpenAI-compatible). Overstory routes all model
// calls through one metered client. Opus-class for analysis + provocation
// (quality-critical, D16); a cheap tier for seeding/ranking/triage.
import { z } from 'zod'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

export type ModelTier = 'reasoning' | 'fast'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

const DEFAULT_MODELS: Record<ModelTier, string> = {
  reasoning: 'anthropic/claude-sonnet-4.6',
  fast: 'anthropic/claude-haiku-4.5',
}

const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  reasoning: 32_000,
  fast: 8_000,
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  costUsd: number | null
}

export interface LlmConfig {
  apiKey: string
  baseUrl?: string
  models?: Partial<Record<ModelTier, string>>
  referer?: string
  title?: string
  timeoutMs?: number
  maxRetries?: number
  onUsage?: (model: string, usage: TokenUsage) => void
}

export interface CallOptions {
  tier?: ModelTier
  effort?: ReasoningEffort
  /** Enable thinking tokens. Defaults to true for the reasoning tier. */
  reasoning?: boolean
  maxTokens?: number
  system?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  max_tokens: number
  response_format: {
    type: 'json_schema'
    json_schema: { name: string; strict: true; schema: Record<string, unknown> }
  }
  reasoning?: { effort: ReasoningEffort }
  usage: { include: true }
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  error?: { message?: string }
}

const RETRYABLE = new Set([429, 500, 502, 503, 529])

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: 'empty',
  ) {
    super(message)
  }
}

export class Llm {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly models: Record<ModelTier, string>
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly referer?: string
  private readonly title?: string
  private readonly onUsage?: LlmConfig['onUsage']

  constructor(config: LlmConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
    // Empty overrides (e.g. an unset OVERSTORY_MODEL_* env var) fall back to defaults.
    this.models = {
      reasoning: config.models?.reasoning || DEFAULT_MODELS.reasoning,
      fast: config.models?.fast || DEFAULT_MODELS.fast,
    }
    this.timeoutMs = config.timeoutMs ?? 180_000
    this.maxRetries = config.maxRetries ?? 3
    this.referer = config.referer
    this.title = config.title
    this.onUsage = config.onUsage
  }

  /** Run a prompt and parse the response against a Zod schema (structured output). */
  async extract<T>(
    prompt: string,
    schema: z.ZodType<T>,
    name: string,
    opts: CallOptions = {},
  ): Promise<T> {
    const tier = opts.tier ?? 'reasoning'
    const model = this.models[tier]
    const useReasoning = opts.reasoning ?? tier === 'reasoning'

    const messages: ChatMessage[] = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: prompt })

    const body: ChatRequest = {
      model,
      messages,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS[tier],
      response_format: {
        type: 'json_schema',
        json_schema: { name, strict: true, schema: toJsonSchema(schema) },
      },
      usage: { include: true },
    }
    if (useReasoning) body.reasoning = { effort: opts.effort ?? 'high' }

    const content = await this.complete(body)
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new LlmError(`model returned non-JSON output for "${name}"`)
    }
    return schema.parse(parsed)
  }

  private async complete(body: ChatRequest): Promise<string> {
    try {
      return await this.send(body)
    } catch (err) {
      // Reasoning + structured output can 400 or yield an empty completion on
      // some providers (reasoning eats the token budget); retry once without it.
      if (err instanceof LlmError && body.reasoning && (err.status === 400 || err.code === 'empty')) {
        const { reasoning: _omit, ...withoutReasoning } = body
        return this.send(withoutReasoning)
      }
      throw err
    }
  }

  private async send(body: ChatRequest): Promise<string> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await sleep(400 * 2 ** (attempt - 1))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!res.ok) {
          const detail = await res.text().catch(() => res.statusText)
          if (RETRYABLE.has(res.status) && attempt < this.maxRetries) {
            lastErr = new LlmError(`OpenRouter ${res.status}: ${detail}`, res.status)
            continue
          }
          throw new LlmError(`OpenRouter ${res.status}: ${detail}`, res.status)
        }
        const data = (await res.json()) as ChatResponse
        if (data.error) throw new LlmError(data.error.message ?? 'OpenRouter error')
        const choice = data.choices?.[0]
        this.meter(body.model, data.usage)
        if (!choice?.message?.content) {
          throw new LlmError(
            `OpenRouter returned an empty completion (finish_reason: ${choice?.finish_reason ?? 'unknown'})`,
            undefined,
            'empty',
          )
        }
        return choice.message.content
      } catch (err) {
        lastErr = err
        if (err instanceof LlmError) throw err
        // Network/abort errors are retryable until the budget is exhausted.
        if (attempt >= this.maxRetries) break
      } finally {
        clearTimeout(timer)
      }
    }
    throw new LlmError(
      `request failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`,
    )
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (this.referer) h['HTTP-Referer'] = this.referer
    if (this.title) h['X-Title'] = this.title
    return h
  }

  private meter(model: string, usage: ChatResponse['usage']): void {
    this.onUsage?.(model, {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      costUsd: usage?.cost ?? null,
    })
  }
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  return rest
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
