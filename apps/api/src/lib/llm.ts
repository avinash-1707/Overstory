import { env } from '@overstory/config'
import { Llm, type TokenUsage } from '@overstory/core/llm'
import { log } from './log'

// The server-side LLM (D25/D31): the contradiction check runs its judgment HERE, in the
// backend, not in the agent — so Overstory holds the key and is the single billing
// chokepoint. One instance per process, lazily built. Returns null when OPENROUTER_API_KEY
// is unset so callers DEGRADE OPEN (no key → no judgment → no conflicts, never a block).
let cached: Llm | null = null

// Per-call usage is logged (observable spend on the one metered path; D32 defers the billing ledger).
function logUsage(model: string, u: TokenUsage): void {
  log.info('llm usage', {
    model,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    costUsd: u.costUsd ?? null,
  })
}

export function getLlm(): Llm | null {
  if (cached) return cached
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) return null
  cached = new Llm({
    apiKey,
    referer: 'https://overstory.dev',
    title: 'Overstory',
    models: { reasoning: env.OVERSTORY_MODEL_REASONING, fast: env.OVERSTORY_MODEL_FAST },
    onUsage: logUsage,
    // Bound TOTAL wall-clock well under the MCP client's patience. check is advisory and
    // degrades open, so one attempt + at most one retry is plenty; worst case ~25s+backoff+25s.
    // The MCP proxy aborts check at 30s (tools/index.ts) and degrades open, so a slow call never
    // blocks the agent — at most it orphans a bounded retry. (audit H6/M3)
    timeoutMs: 25_000,
    maxRetries: 1,
  })
  return cached
}
