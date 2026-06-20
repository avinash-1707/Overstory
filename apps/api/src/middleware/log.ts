import { randomUUID } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { log } from '../lib/log'

// Request logging. Assigns each request a correlation id (honoring an inbound x-request-id so a
// trace survives across hops) and emits a structured `request` line when the handler completes.
// requestId is stashed on the context so the app-level onError can correlate an error to its
// request. Note: Hono's compose catches a thrown handler, runs onError, then returns to this
// middleware normally — so an ERRORED request produces TWO correlated lines (onError's `error`
// line + this `request` line, status 500), both sharing the same reqId. A successful request
// produces exactly one `request` line.

export type LogVars = { requestId: string }

export const requestLogger = createMiddleware<{ Variables: LogVars }>(async (c, next) => {
  const requestId = c.req.header('x-request-id') || randomUUID()
  c.set('requestId', requestId)
  const start = Date.now()
  await next()
  log.info('request', {
    reqId: requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
  })
})
