// Pure tenant-scope resolution logic for the dashboard (D36). Holds the leak-critical
// branch decisions with NO db/env/IO imports, so it is unit-testable in isolation —
// resolveDashCtx (dashboard.ts) does the queries and feeds the rows in here.
//
// Fail-closed is the contract: a null result means "no valid tenant for this user", which
// callers render as empty — NEVER a fall-through to a default tenant (that was audit C1).

export interface OrgPick {
  orgId: string | null
  ambiguous: boolean // user is a member of >1 org — picked the oldest, flag for a warn
}

// Resolve which org scopes the dashboard.
// - activeOrgId is the session's activeOrganizationId. It is client-influenceable, so it is
//   honored ONLY when activeOrgIsMember proves (via the member table) the user belongs to it.
//   A set-but-unverified active org is DISCARDED, not trusted — the leak-closing branch.
// - memberOrgIds: the user's org memberships, OLDEST FIRST (caller orders by member.createdAt).
//   It is the real primary resolver: activeOrganizationId is never written at runtime today,
//   so a fresh session always falls here.
export function resolveOrgId(
  activeOrgId: string | null,
  activeOrgIsMember: boolean,
  memberOrgIds: string[],
): OrgPick {
  if (activeOrgId !== null && activeOrgIsMember) return { orgId: activeOrgId, ambiguous: false }
  if (memberOrgIds.length === 0) return { orgId: null, ambiguous: false }
  return { orgId: memberOrgIds[0] ?? null, ambiguous: memberOrgIds.length > 1 }
}

export interface RepoPick {
  repoId: string | null
  ambiguous: boolean // org has >1 repo — picked the oldest, flag for a warn
}

// Resolve which repo within the (already tenant-verified) org the dashboard shows.
// repoIds: the org's repos, OLDEST FIRST (caller orders by repos.createdAt). The schema allows
// N repos per org; picking is purely a UX-determinism choice and never crosses the tenant
// boundary (any repo here is already inside the verified org), so >1 is a warn, not an error.
export function resolveRepoId(repoIds: string[]): RepoPick {
  if (repoIds.length === 0) return { repoId: null, ambiguous: false }
  return { repoId: repoIds[0] ?? null, ambiguous: repoIds.length > 1 }
}
