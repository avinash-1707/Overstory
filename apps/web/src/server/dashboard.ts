import { eq } from 'drizzle-orm'
import { organization, repos } from '@overstory/db/schema'
import type { RepoId, WorkspaceId } from '@overstory/db/schema'
import { getActivityMetrics, getSessionTimeline, listSessions } from '@overstory/core/dashboard'
import type { DashCtx, DashWindow } from '@overstory/core/dashboard'
import { db } from './db'

// Dogfood tenant resolver. Until auth lands (pass 2), the dashboard reads the single
// seeded workspace + its repo. When Better Auth is wired, replace the body with the
// session path: getSession(headers) -> activeOrganizationId (member-table fallback) ->
// the workspace's repo. Signature stays the same, so callers don't change. (D34 analog:
// scope is resolved server-side, never from client input.)
export async function resolveDashCtx(): Promise<DashCtx> {
  const [org] = await db.select({ id: organization.id }).from(organization).limit(1)
  if (!org) throw new Error('no workspace seeded — run: pnpm --filter @overstory/api seed')
  const workspaceId = org.id as WorkspaceId
  const [repo] = await db
    .select({ id: repos.id })
    .from(repos)
    .where(eq(repos.workspaceId, workspaceId))
    .limit(1)
  if (!repo) throw new Error('no repo seeded for this workspace')
  return { db, workspaceId, repoId: repo.id as RepoId }
}

// Server-only data fns — called inside createServerFn handlers (see routes). Each
// resolves the tenant scope then delegates to the shared @overstory/core/dashboard layer.
export async function fetchSessions(window: DashWindow) {
  return listSessions(await resolveDashCtx(), { window })
}
export async function fetchTimeline(sessionId: string) {
  return getSessionTimeline(await resolveDashCtx(), sessionId)
}
export async function fetchMetrics(window: DashWindow) {
  return getActivityMetrics(await resolveDashCtx(), window)
}
