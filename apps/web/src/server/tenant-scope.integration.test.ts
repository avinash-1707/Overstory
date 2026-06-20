import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { member, organization, repos, serveEvents, user } from '@overstory/db/schema'
import type { RepoId, WorkspaceId } from '@overstory/db/schema'
import { db } from './db'
import { fetchSessions, resolveDashCtx } from './dashboard'
import type { Session } from './auth.guards'

// Cross-tenant boundary test (D36) — the assertion the pure unit tests structurally CANNOT make:
// it runs the REAL member / repos / activeOrgIsMember queries in resolveDashCtx against a live
// Postgres to prove a session can never read another org's data, even via a forged
// activeOrganizationId. This is the hard gate before flipping OVERSTORY_OPEN_SIGNUP open
// (docs/technical/multi-tenant.md, rollout step 3-4).
//
// OPT-IN ONLY (OVERSTORY_RUN_DB_TESTS=1) and against a THROWAWAY database — it writes rows, so it
// must never point at the dogfood DB. Plain `pnpm test` (no flag) skips it. Run it with:
//   DATABASE_URL=<throwaway> OVERSTORY_RUN_DB_TESTS=1 pnpm --filter @overstory/web test
const RUN = process.env.OVERSTORY_RUN_DB_TESTS === '1'

// Unique suffix so seeded rows never collide with existing data and cleanup is exact.
const tag = randomUUID().slice(0, 8)
const orgA = `org-A-${tag}`
const orgB = `org-B-${tag}`
const userA = `user-A-${tag}`
const userB = `user-B-${tag}`
const userC = `user-C-${tag}` // belongs to no org
let repoA = ''
let repoB = ''

// resolveDashCtx reads only session.user.id and session.session.activeOrganizationId.
function sessionFor(userId: string, activeOrganizationId: string | null): Session {
  return { user: { id: userId }, session: { activeOrganizationId } } as unknown as Session
}

describe.skipIf(!RUN)('resolveDashCtx — cross-tenant boundary (integration)', () => {
  beforeAll(async () => {
    const now = new Date()
    await db.insert(organization).values([
      { id: orgA, name: `A-${tag}`, slug: `a-${tag}`, createdAt: now },
      { id: orgB, name: `B-${tag}`, slug: `b-${tag}`, createdAt: now },
    ])
    await db.insert(user).values([
      { id: userA, name: 'A', email: `a-${tag}@test.local` },
      { id: userB, name: 'B', email: `b-${tag}@test.local` },
      { id: userC, name: 'C', email: `c-${tag}@test.local` },
    ])
    await db.insert(member).values([
      { id: `m-A-${tag}`, organizationId: orgA, userId: userA, role: 'owner', createdAt: now },
      { id: `m-B-${tag}`, organizationId: orgB, userId: userB, role: 'owner', createdAt: now },
    ])
    const [rA] = await db
      .insert(repos)
      .values({ workspaceId: orgA as WorkspaceId, name: `repo-${tag}` })
      .returning({ id: repos.id })
    const [rB] = await db
      .insert(repos)
      .values({ workspaceId: orgB as WorkspaceId, name: `repo-${tag}` })
      .returning({ id: repos.id })
    repoA = rA?.id ?? ''
    repoB = rB?.id ?? ''
    // One activity event under A's repo only — B must never see it.
    await db.insert(serveEvents).values({
      workspaceId: orgA as WorkspaceId,
      repoId: repoA as RepoId,
      sessionId: `sess-A-${tag}`,
      tool: 'guard',
      query: { files: ['x.ts'] },
      latencyMs: 1,
    })
  })

  afterAll(async () => {
    // organization cascades to repos / serve_events / member; users have no org FK, delete them too.
    await db.delete(organization).where(inArray(organization.id, [orgA, orgB]))
    await db.delete(user).where(inArray(user.id, [userA, userB, userC]))
  })

  it('scopes a user with no active org to their own org', async () => {
    const ctx = await resolveDashCtx(sessionFor(userB, null))
    expect(ctx?.workspaceId).toBe(orgB)
    expect(ctx?.repoId).toBe(repoB)
  })

  it('discards a forged active org and never scopes to it', async () => {
    // userB forges activeOrganizationId = orgA (not a member) -> must resolve to B, never A.
    const ctx = await resolveDashCtx(sessionFor(userB, orgA))
    expect(ctx?.workspaceId).toBe(orgB)
    expect(ctx?.workspaceId).not.toBe(orgA)
    expect(ctx?.repoId).toBe(repoB)
    expect(ctx?.repoId).not.toBe(repoA)
  })

  it('returns null for a zero-org user, even with a forged active org', async () => {
    expect(await resolveDashCtx(sessionFor(userC, null))).toBeNull()
    expect(await resolveDashCtx(sessionFor(userC, orgA))).toBeNull()
  })

  it('serves only the caller org activity (B sees none of A, via the full read path)', async () => {
    const aSessions = await fetchSessions(sessionFor(userA, null), 'all')
    expect(aSessions.length).toBe(1)
    expect(aSessions[0]?.sessionId).toBe(`sess-A-${tag}`)
    // userB with a forged active org pointing at A -> empty, never A's session.
    const bSessions = await fetchSessions(sessionFor(userB, orgA), 'all')
    expect(bSessions).toEqual([])
  })
})
