import { and, asc, eq } from 'drizzle-orm'
import { member, repos } from '@overstory/db/schema'
import type { RepoId, WorkspaceId } from '@overstory/db/schema'
import { getActivityMetrics, getSessionTimeline, listSessions } from '@overstory/core/dashboard'
import type { ActivityMetrics, DashCtx, DashWindow } from '@overstory/core/dashboard'
import { db } from './db'
import type { Session } from './auth.guards'
import { resolveOrgId, resolveRepoId } from './tenant-scope'

// Session-derived tenant scope (D36). The dashboard's analog of apps/api's apiKey->{workspace,repo}
// (middleware/auth.ts): scope comes ONLY from data keyed by the verified session userId, never from
// client input (D34). Returns null = no valid tenant for this user — callers render empty, NEVER a
// fall-through to a default tenant (that fall-through was audit C1). DB errors propagate; the only
// swallow is the null resolution path (a known-empty state, not an error).
export async function resolveDashCtx(session: Session): Promise<DashCtx | null> {
  const userId = session.user.id
  const active = session.session.activeOrganizationId ?? null

  // The leak-closing check: activeOrganizationId is client-influenceable, so a set value scopes
  // nothing until the member table confirms this user belongs to it. An unverified active org is
  // discarded (falls to the membership lookup), never trusted.
  // INVARIANT (do not optimize away): this live member re-query is also what makes Better Auth's
  // session cookieCache safe. The session here may be served from a signed cookie up to 5 min
  // stale, so tenant scope MUST be re-derived from live `member` rows keyed by the immutable
  // userId — never trust a cached activeOrganizationId without this check, or the cache becomes a
  // cross-tenant leak window.
  const activeOrgIsMember =
    active !== null &&
    (
      await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, userId), eq(member.organizationId, active)))
        .limit(1)
    ).length > 0

  // The real primary resolver: activeOrganizationId is never written at runtime today, so every
  // fresh session falls here. Oldest membership first -> deterministic pick.
  const memberOrgs = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    // member.id as a stable secondary key: createdAt is not unique, so without it two memberships
    // made in the same instant give an undefined tie-break — the chosen org could flip per request.
    .orderBy(asc(member.createdAt), asc(member.id))

  const org = resolveOrgId(active, activeOrgIsMember, memberOrgs.map((m) => m.organizationId))
  if (org.ambiguous) console.warn(`[tenant] user ${userId} belongs to >1 org; scoping to the oldest`)
  if (!org.orgId) return null // zero-org (or unverified active org + no memberships) -> fail closed
  const workspaceId = org.orgId as WorkspaceId

  const repoRows = await db
    .select({ id: repos.id })
    .from(repos)
    .where(eq(repos.workspaceId, workspaceId))
    .orderBy(asc(repos.createdAt), asc(repos.id))

  const repo = resolveRepoId(repoRows.map((r) => r.id))
  if (repo.ambiguous) console.warn(`[tenant] org ${workspaceId} has >1 repo; scoping to the oldest`)
  if (!repo.repoId) return null // org has no repo -> fail closed
  return { db, workspaceId, repoId: repo.repoId as RepoId }
}

// Zeroed metrics for the no-tenant case — same shape getActivityMetrics returns, so the UI
// renders its empty states instead of a tenant's data.
function emptyMetrics(window: DashWindow): ActivityMetrics {
  return {
    window,
    sessionsTotal: 0,
    sessionsWithContext: 0,
    sessionsWithGuard: 0,
    consultRate: 0,
    alwaysOnInjections: 0,
    guardCalls: 0,
    guardHits: 0,
    conflicts: 0,
    guardByPath: [],
    mostServed: [],
  }
}

export async function fetchSessions(session: Session, window: DashWindow) {
  const ctx = await resolveDashCtx(session)
  return ctx ? listSessions(ctx, { window }) : []
}
export async function fetchTimeline(session: Session, sessionId: string) {
  const ctx = await resolveDashCtx(session)
  return ctx ? getSessionTimeline(ctx, sessionId) : []
}
export async function fetchMetrics(session: Session, window: DashWindow) {
  const ctx = await resolveDashCtx(session)
  return ctx ? getActivityMetrics(ctx, window) : emptyMetrics(window)
}
