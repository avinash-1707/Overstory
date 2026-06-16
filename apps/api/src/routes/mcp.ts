import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { getAlwaysOn, getDecision, guardByFiles } from '@overstory/core/serving'
import type { ServeCtx } from '@overstory/core/serving'
import type { DecisionId } from '@overstory/db/schema'
import { db } from '../lib/db'
import type { AuthVars } from '../middleware/auth'

// /v1/mcp/* — the serving surface the MCP server proxies to. ApiKey-scoped (the
// /v1/* middleware ran first); repo + workspace come from the key. Reads only, no
// LLM. Each handler delegates to a core/serving fn that logs its own ServeEvent (D28).
// See docs/technical/serving.md.

const guardBody = z.object({ files: z.array(z.string()).default([]) })

// Build the tenant-scoped serve context, or null if the key isn't repo-bound.
function serveCtx(c: Context<{ Variables: AuthVars }>): ServeCtx | null {
  const { workspaceId, repoId } = c.get('auth')
  if (!repoId) return null
  // One MCP stdio connection = one agent session (D28); header set by the MCP server.
  const sessionId = c.req.header('x-overstory-session') || 'unknown'
  return { db, workspaceId, repoId, sessionId }
}

export const mcp = new Hono<{ Variables: AuthVars }>()

// always-on tier (D20)
mcp.get('/mcp/context', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  return c.json({ decisions: await getAlwaysOn(ctx) })
})

// file→decisions guard (D17)
mcp.post('/mcp/guard', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const parsed = guardBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid body', detail: parsed.error.issues }, 400)
  return c.json({ decisions: await guardByFiles(ctx, parsed.data.files) })
})

// read one decision in full
mcp.get('/mcp/decision/:id', async (c) => {
  const ctx = serveCtx(c)
  if (!ctx) return c.json({ error: 'api key is not bound to a repo' }, 400)
  const decision = await getDecision(ctx, c.req.param('id') as DecisionId)
  if (!decision) return c.json({ error: 'not found' }, 404)
  return c.json({ decision })
})
