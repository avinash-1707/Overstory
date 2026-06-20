import { createServerFn } from '@tanstack/react-start'
import type { DashWindow } from '@overstory/core/dashboard'
import { fetchMetrics, fetchSessions, fetchTimeline } from './dashboard'
import { requireSession } from './auth.guards'

// createServerFn wrappers — the web's data API. Run server-side only; each delegates to
// server/dashboard.ts (tenant resolve + shared @overstory/core/dashboard reads). Plain
// function validators (no zod dep needed) coerce input and keep types tight. Every handler
// re-checks the session via requireSession() — these RPC endpoints are reachable directly,
// independent of the route's beforeLoad UI gate.
const WINDOWS: DashWindow[] = ['7d', '30d', '90d', 'all']
function asWindow(w: unknown): DashWindow {
  return WINDOWS.includes(w as DashWindow) ? (w as DashWindow) : 'all'
}

export const sessionsFn = createServerFn({ method: 'GET' })
  .validator((d: { window?: string }) => ({ window: asWindow(d?.window) }))
  .handler(async ({ data }) => {
    const session = await requireSession()
    return fetchSessions(session, data.window)
  })

export const timelineFn = createServerFn({ method: 'GET' })
  .validator((d: { sessionId: string }) => ({ sessionId: String(d.sessionId) }))
  .handler(async ({ data }) => {
    const session = await requireSession()
    return fetchTimeline(session, data.sessionId)
  })

export const metricsFn = createServerFn({ method: 'GET' })
  .validator((d: { window?: string }) => ({ window: asWindow(d?.window) }))
  .handler(async ({ data }) => {
    const session = await requireSession()
    return fetchMetrics(session, data.window)
  })
