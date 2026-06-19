// Minimal in-memory fixed-window rate limiter. Per-process — fine for the single dogfood API
// instance; a shared store (Redis/Postgres) lands with multi-instance deploy. Used to cap the
// metered /v1/mcp/check path so a runaway or compromised ApiKey can't burn unbounded OpenRouter
// credits (audit H2) — the credit ledger (D32) is the durable replacement.

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

/**
 * Returns ok=false once `limit` calls for `key` occur within `windowMs`. Stale windows are
 * overwritten lazily on the next call for that key (so the map stays small for active keys; a
 * key that goes silent leaves one tuple behind — negligible at any realistic key count).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const w = buckets.get(key)
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }
  if (w.count >= limit) return { ok: false, retryAfterMs: w.resetAt - now }
  w.count++
  return { ok: true, retryAfterMs: 0 }
}
