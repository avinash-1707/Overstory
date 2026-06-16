import './env'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { auth } from './lib/auth'
import { apiKeyAuth, type AuthVars } from './middleware/auth'
import { capture } from './routes/capture'

// @overstory/api — Hono backend for MACHINE clients (D29):
//   - capture persist (CLI → /v1/capture)
//   - MCP serving lookups + ServeEvent logging (/v1/mcp/*, next stage)
//   - GitHub App webhooks (PR contradiction check, D11/D27 — later)
// Human UI lives in apps/web (TanStack Start). Shared data layer: @overstory/db.

const app = new Hono<{ Variables: AuthVars }>()

app.get('/health', (c) => c.json({ ok: true }))

// Better Auth — session-based human auth (web app + future dashboard).
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Machine clients (CLI, MCP) — every /v1/* route requires a bearer ApiKey.
app.use('/v1/*', apiKeyAuth)
app.route('/v1', capture)

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`api listening on :${port}`)
})

export type AppType = typeof app
