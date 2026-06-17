import { createServerFn } from '@tanstack/react-start'
import type { DashWindow } from '@overstory/core/dashboard'
import { fetchMetrics, fetchSessions, fetchTimeline } from './dashboard'

// createServerFn wrappers — the web's data API. Run server-side only; each delegates to
// server/dashboard.ts (tenant resolve + shared @overstory/core/dashboard reads). Plain
// function validators (no zod dep needed) coerce input and keep types tight.
const WINDOWS: DashWindow[] = ['7d', '30d', '90d', 'all']
function asWindow(w: unknown): DashWindow {
  return WINDOWS.includes(w as DashWindow) ? (w as DashWindow) : 'all'
}

export const sessionsFn = createServerFn({ method: 'GET' })
  .validator((d: { window?: string }) => ({ window: asWindow(d?.window) }))
  .handler(async ({ data }) => fetchSessions(data.window))

export const timelineFn = createServerFn({ method: 'GET' })
  .validator((d: { sessionId: string }) => ({ sessionId: String(d.sessionId) }))
  .handler(async ({ data }) => fetchTimeline(data.sessionId))

export const metricsFn = createServerFn({ method: 'GET' })
  .validator((d: { window?: string }) => ({ window: asWindow(d?.window) }))
  .handler(async ({ data }) => fetchMetrics(data.window))
