import { z } from 'zod'

// @overstory/config — the ONE place environment configuration is loaded, validated, and
// dependency-checked. No other module reads process.env or loads .env directly: import
// `env` (typed, optional values) or call `requireEnv(key)` (throws if a needed var is
// missing). Each process only requires the subset it actually uses.

// Load the repo-root .env once, trying paths relative to the common CWDs (repo root,
// apps/*, packages/*). Vars already in the ambient environment are kept; loadEnvFile fills
// gaps. Each missing path is ignored.
for (const path of ['.env', '../.env', '../../.env', '../../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // not present at this path — try the next, or rely on the ambient environment
  }
}

const schema = z.object({
  // Data layer (Neon Postgres, D26)
  DATABASE_URL: z.string().min(1).optional(),
  // Auth (Better Auth, D26/D37)
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  WEB_BASE_URL: z.string().url().optional(),
  // Public email/password sign-up. Defaults CLOSED (any non-"true" value, incl. unset,
  // disables sign-up) — until the dashboard derives tenant scope from the session (D36),
  // an open form + the single seeded workspace = cross-tenant read. Set to "true" only to
  // mint the operator account out-of-band, then unset. See docs/audits/2026-06-19.md (C1).
  OVERSTORY_OPEN_SIGNUP: z.string().min(1).optional(),
  // LLM via OpenRouter (D31)
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OVERSTORY_MODEL_REASONING: z.string().min(1).optional(),
  OVERSTORY_MODEL_FAST: z.string().min(1).optional(),
  // Machine clients (CLI, MCP) -> backend (D34)
  OVERSTORY_API_URL: z.string().url().optional(),
  OVERSTORY_API_KEY: z.string().min(1).optional(),
  // API server
  PORT: z.coerce.number().int().positive().optional(),
  // Seed overrides (apps/api seed)
  SEED_WORKSPACE: z.string().min(1).optional(),
  SEED_REPO: z.string().min(1).optional(),
})

// Empty-string env vars (e.g. `OVERSTORY_MODEL_FAST=` in .env) are treated as ABSENT —
// otherwise `.optional()` lets "" through and it fails `.min(1)`/`.url()`.
const present = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''),
)

export const env = schema.parse(present)
export type Env = typeof env

// Assert a required variable is present. Call at the point a feature needs it, so each
// process only enforces its own subset (e.g. the MCP server requires OVERSTORY_API_*,
// not DATABASE_URL).
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${String(key)}`)
  }
  return value as NonNullable<Env[K]>
}
