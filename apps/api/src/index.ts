import { serve } from '@hono/node-server'
import { Hono } from 'hono'

// @overstory/api — Hono backend for MACHINE clients (D29):
//   - MCP server backend (serving lookups + ServeEvent logging)
//   - CLI auth + capture trigger
//   - GitHub App webhooks (PR contradiction check, D11/D27)
// Human UI lives in apps/web (TanStack Start). Shared data layer: @overstory/db.

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

// TODO: mount routes — ./routes/mcp, ./routes/webhooks, ./routes/auth

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`api listening on :${port}`)
})

export type AppType = typeof app
