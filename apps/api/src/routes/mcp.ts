import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { getAlwaysOn, getDecision, guardByFiles, searchByQuery } from '@overstory/core/serving'
import type { ServeCtx } from '@overstory/core/serving'
import { checkContradictions } from '@overstory/core/contradiction'
import type { DecisionId } from '@overstory/db/schema'
import { db } from '../lib/db'
import { getLlm } from '../lib/llm'
import { log } from '../lib/log'
import { rateLimit } from '../lib/rate-limit'
import type { AuthVars } from '../middleware/auth'
import type { LogVars } from '../middleware/log'

// /v1/mcp/* — the serving surface the MCP server proxies to. ApiKey-scoped (the
// /v1/* middleware ran first); repo + workspace come from the key. context/guard/decision
// are reads-only (no LLM); check (D11) runs an LLM judgment server-side (the metered
// chokepoint, D25). Each handler delegates to a core fn that logs its own ServeEvent (D28).
// See docs/technical/serving.md.

const guardBody = z.object({ files: z.array(z.string()).default([]) })
const checkBody = z.object({
  files: z.array(z.string()).default([]),
  summary: z.string().default(''),
})
const searchBody = z.object({ query: z.string().default('') })

// Per-key ceiling on the only metered (LLM) path. A normal agent makes a handful of checks per
// task; 30/min absorbs that while stopping a runaway loop from draining credits (audit H2).
const CHECK_CALLS_PER_MIN = 30

function serveCtx(c: Context<{ Variables: AuthVars & LogVars }>): ServeCtx | null {
  const { workspaceId, repoId } = c.get('auth')
  if (!repoId) return null
  // One MCP stdio connection = one agent session (D28); header set by the MCP server.
  const sessionId = c.req.header('x-overstory-session') || 'unknown'
  return { db, workspaceId, repoId, sessionId }
}

export const mcp = new Hono<{ Variables: AuthVars & LogVars }>()

mcp.get('/mcp/context', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  return c.json({ decisions: await getAlwaysOn(ctx) })
})

mcp.post('/mcp/guard', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const parsed = guardBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body', detail: parsed.error.issues }, 400)
  return c.json({ decisions: await guardByFiles(ctx, parsed.data.files) })
})

// contradiction check (D11) — LLM judgment runs server-side (the metered chokepoint, D25).
mcp.post('/mcp/check', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const parsed = checkBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body', detail: parsed.error.issues }, 400)
  // Cost guard on the only metered path: over the per-key ceiling, degrade open (empty
  // conflicts, 200) rather than error the agent — same contract as a missing LLM key.
  const { apiKeyId } = c.get('auth')
  if (!rateLimit(`check:${apiKeyId}`, CHECK_CALLS_PER_MIN, 60_000).ok) {
    log.warn('mcp/check rate-limited', { apiKeyId, reqId: c.get('requestId') })
    return c.json({ conflicts: [] })
  }
  // Degrade open: no LLM key (or any failure) → no conflicts, never block the agent.
  const llm = getLlm()
  if (!llm) return c.json({ conflicts: [] })
  try {
    return c.json({ conflicts: await checkContradictions(ctx, llm, parsed.data) })
  } catch (err) {
    log.error('mcp/check failed', { err, reqId: c.get('requestId') })
    return c.json({ conflicts: [] })
  }
})

mcp.post('/mcp/search', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const parsed = searchBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body', detail: parsed.error.issues }, 400)
  return c.json({ decisions: await searchByQuery(ctx, parsed.data.query) })
})

mcp.get('/mcp/decision/:id', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const decision = await getDecision(ctx, c.req.param('id') as DecisionId)
  if (!decision) return c.json({ error: 'not found' }, 404)
  return c.json({ decision })
})
