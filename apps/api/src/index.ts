import { env } from '@overstory/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { auth } from './lib/auth'
import { apiKeyAuth, type AuthVars } from './middleware/auth'
import { capture } from './routes/capture'
import { mcp } from './routes/mcp'

// @overstory/api — Hono backend for MACHINE clients (D29):
//   - capture persist (CLI → /v1/capture)
//   - MCP serving lookups + ServeEvent logging (/v1/mcp/*, next stage)
//   - GitHub App webhooks (PR contradiction check, D11/D27 — later)
// Human UI lives in apps/web (TanStack Start). Shared data layer: @overstory/db.

const app = new Hono<{ Variables: AuthVars }>()

// Global failsafe: any uncaught error (incl. a DB lookup that throws in apiKeyAuth) becomes a
// generic 500 with no body, never a leaked stack or a hung request (audit H1). The auth gate
// stays fail-CLOSED — a thrown error never lets an unauthenticated request through.
app.onError((err, c) => {
  console.error('api error', err)
  return c.json({ error: 'internal error' }, 500)
})

app.get('/health', (c) => c.json({ ok: true }))

// Better Auth — session-based human auth (web app + future dashboard).
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Machine clients (CLI, MCP) — every /v1/* route requires a bearer ApiKey.
app.use('/v1/*', apiKeyAuth)
app.route('/v1', capture)
app.route('/v1', mcp)

const port = env.PORT ?? 3001
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`api listening on :${port}`)
})

export type AppType = typeof app
