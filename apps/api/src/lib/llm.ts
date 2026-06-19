import { env } from '@overstory/config'
import { Llm, type TokenUsage } from '@overstory/core/llm'

// The server-side LLM (D25/D31): the contradiction check runs its judgment HERE, in the
// backend, not in the agent — so Overstory holds the key and is the single billing
// chokepoint. One instance per process, lazily built. Returns null when OPENROUTER_API_KEY
// is unset so callers DEGRADE OPEN (no key → no judgment → no conflicts, never a block).
let cached: Llm | null = null

// Per-call usage is logged now (observable spend on the one metered path). A persistent
// credit/billing ledger is the chokepoint's next step, deferred with the credit system (D32).
function logUsage(model: string, u: TokenUsage): void {
  console.error(
    `[llm-usage] ${model} prompt=${u.promptTokens} completion=${u.completionTokens} cost=${u.costUsd ?? 'n/a'}`,
  )
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
    // Bound a single attempt under the MCP client's 60s patience (tools/index.ts) so a slow
    // call doesn't orphan too far past the point the agent already degraded open.
    timeoutMs: 50_000,
  })
  return cached
}
