import { queryOptions } from '@tanstack/react-query'
import type { DashWindow } from '@overstory/core/dashboard'
import { metricsFn, sessionsFn, timelineFn } from '../server/functions'

// React Query options wrapping the TanStack Start server functions. Same options object
// is used by route loaders (queryClient.ensureQueryData) for SSR prefetch and by
// components (useSuspenseQuery) for reads, so there is one cache key and no waterfall.

export const sessionsQuery = (window: DashWindow = 'all') =>
  queryOptions({
    queryKey: ['sessions', window],
    queryFn: () => sessionsFn({ data: { window } }),
  })

export const timelineQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ['timeline', sessionId],
    queryFn: () => timelineFn({ data: { sessionId } }),
  })

export const metricsQuery = (window: DashWindow = 'all') =>
  queryOptions({
    queryKey: ['metrics', window],
    queryFn: () => metricsFn({ data: { window } }),
  })
