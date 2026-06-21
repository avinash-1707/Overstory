import { env } from '@overstory/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { startDbKeepalive } from '@overstory/db'
import { auth } from './lib/auth'
import { db } from './lib/db'
import { log } from './lib/log'
import { apiKeyAuth, type AuthVars } from './middleware/auth'
import { requestLogger, type LogVars } from './middleware/log'
import { capture } from './routes/capture'
import { mcp } from './routes/mcp'

// @overstory/api — Hono backend for machine clients (CLI/MCP, D29).
// Human UI lives in apps/web (TanStack Start). Shared data layer: @overstory/db.

const app = new Hono<{ Variables: AuthVars & LogVars }>()

// First in the chain: assign a correlation id + log every completed request (structured).
app.use('*', requestLogger)

// Global failsafe: any uncaught error (incl. a DB lookup that throws in apiKeyAuth) becomes a
// generic 500 with no body, never a leaked stack or a hung request (audit H1). The auth gate
// stays fail-CLOSED — a thrown error never lets an unauthenticated request through. The full
// error is logged server-side (correlated by reqId); the client only ever sees the generic 500.
app.onError((err, c) => {
  log.error('unhandled error', { err, reqId: c.get('requestId'), path: c.req.path })
  return c.json({ error: 'internal error' }, 500)
})

app.get('/health', (c) => c.json({ ok: true }))

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Machine clients (CLI, MCP) — every /v1/* route requires a bearer ApiKey.
app.use('/v1/*', apiKeyAuth)
app.route('/v1', capture)
app.route('/v1', mcp)

const port = env.PORT ?? 3001
serve({ fetch: app.fetch, port }, ({ port }) => {
  log.info('api listening', { port })
})

// Keep one Neon connection warm so the auth/serving hot paths reuse it (~300ms) instead of
// re-establishing a connection (~3s) after an idle spell.
startDbKeepalive(db)

export type AppType = typeof app
