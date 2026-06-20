# Overstory — Multi-tenant scope (D36)

> **Status:** Locked build-phase plan (not yet implemented). Closes audit **C1** by replacing the
> session-blind web read layer with session-derived, member-verified tenant scope. Machine clients
> (`apps/api`) are already tenant-safe (ApiKey → workspaceId/repoId); this is the human-path analog.
>
> **Decisions:** refines **D36** (session→workspace scope), honors **D34** (tenant boundary) and
> **D37** (one shared Better Auth config, session→activeOrganizationId + member fallback).

---

## Why this exists

The web read layer is **session-blind**: `resolveDashCtx()` (`apps/web/src/server/dashboard.ts`)
resolves the tenant via `organization … LIMIT 1` — the first org in the DB, with no reference to
the signed-in user. Any authenticated user reads the same (dogfood) tenant's full decision log +
activity. Today the only thing preventing a stranger from reading it is the `disableSignUp` stopgap
(audit **C1**). This is single-tenant-only and a cross-tenant leak the moment `:3000` is
internet-reachable with sign-up reopened.

## The one property that = "leak closed"

> Every `DashCtx.repoId` / `workspaceId` the dashboard scopes a query on derives from an
> `organizationId` that the **`member` table confirms the session's `userId` belongs to** — and
> from no other source.

This is the human-path analog of `apps/api/src/middleware/auth.ts` (where `{workspaceId, repoId}`
come from the ApiKey row, never the request). The "key row" equivalent is the **`member` row keyed
by `userId`**. `activeOrganizationId` is the client-influenceable input and MUST be
membership-checked before use. Resolution **fails closed** — empty/null, never the old first-org.

## Ground facts (verified)

- `session.activeOrganizationId` exists (`schema/auth.ts`) but is **never written at runtime** —
  zero `setActive` calls. So it is null after email/password sign-in → the **`member` lookup is the
  real primary resolver**, not a fallback.
- Better Auth's organization plugin does **not** auto-create an org on sign-up. So a new
  email/password sign-up is a **zero-org user** until an org is provisioned.
- `repos` allows **N per org** (only `UNIQUE(workspaceId, name)`). Dogfood = 1 org / 1 repo.
- The seed (`apps/api/src/seed.ts`) creates `organization` + `repos` + `apiKeys` but **no `user`
  and no `member`**. After member-verification, nobody sees the dogfood data until an operator
  user + member row exist — so extending the seed is a required build step, not optional.

## Resolution algorithm (every branch fails closed)

`resolveDashCtx(session): Promise<DashCtx | null>` — returns `null` = no valid tenant for this user
(callers render empty; never fall through to a default tenant).

1. **active-org, membership-verified.** If `session.activeOrganizationId` is set, confirm a `member`
   row exists for `(userId, activeOrganizationId)`. If yes → use it. If no (stale/forged) → discard,
   go to step 2. (This is the leak-closing branch — "set" never means "authorized".)
2. **member fallback.** `SELECT organizationId FROM member WHERE userId = ? ORDER BY createdAt ASC
   LIMIT 2`. Zero rows → **`return null`** (zero-org). >1 → `console.warn` (multi-org) + take oldest.
3. **repo pick.** `SELECT id FROM repos WHERE workspaceId = orgId ORDER BY createdAt ASC LIMIT 2`.
   Zero → **`return null`** (org-no-repo). >1 → `console.warn` (multi-repo) + take oldest.
4. Return `{ db, workspaceId: orgId as WorkspaceId, repoId as RepoId }` — the two casts remain the
   single scoping chokepoint, now only reachable after a membership-verified org flows in.

**DB errors propagate** — never `try/catch`→default ctx (that would reopen C1 through error
handling). The only swallow is the `null` resolution path (a known-empty state, not an error).

### Failure modes → closed outcome

| Failure | Outcome |
|---|---|
| Null session | `redirect('/sign-in')` — `requireSession()`, unchanged (auth gate) |
| `activeOrganizationId` null | member fallback |
| active-org set, user not a member | **discard active-org**, member fallback |
| Zero-org user | `null` → empty dashboard (tenant gate, NOT a redirect) |
| Org has no repo | `null` → empty dashboard |
| Org has >1 repo | warn + oldest (tenant-safe — any repo under the org is in-boundary) |
| DB error | propagate (error boundary); never catch→default |

*Two distinct closed states: no session → redirect to sign-in; session but no tenant → empty dashboard. Don't conflate.*

## Locked decisions

- **New sign-ups → empty dashboard.** A zero-org user lands on a discreet "no workspace" state
  (D37 copy: no em dashes, no mechanism leak). No auto-create-org-on-sign-up (stays in scope:
  fix the boundary, don't build multi-tenancy as a feature).
- **Operator access → extend the seed.** Seed creates an operator `user` (Better Auth,
  `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` env) + a `member` row in the dogfood org.
  Repeatable; matches the existing seed pattern.
- **Tests → introduce Vitest now**, scoped to the leak-critical resolver (no suite exists yet).
- **Multi-org / multi-repo user → pick oldest by `createdAt` + `console.warn`** (leak-safe either
  way; should not occur yet). "Active repo" selection is deferred cleanly — it would only ever
  narrow *within* an already-verified org, so it never touches the trust boundary.

## Files to touch

1. `apps/web/src/server/dashboard.ts` — rewrite `resolveDashCtx(session)`; add `assertMember()` +
   `emptyMetrics()`. Fetch wrappers (`fetchSessions/Timeline/Metrics`) take `session`, gate `null`
   → empty (`[]` / zeroed metrics).
2. `apps/web/src/server/functions.ts` — capture session from `requireSession()`, thread it in; keep
   `requireSession()` as an independent auth gate (defense in depth). `DashCtx` itself unchanged.
3. `apps/web/src/routes/_dashboard.tsx` — "no workspace" empty state when ctx is null (canvas: copy).
4. `apps/api/src/seed.ts` — create operator user + member row (env-driven).
5. New Vitest suite — resolver matrix + boundary integration test (below).
6. `packages/core/src/auth/index.ts` — flip `OVERSTORY_OPEN_SIGNUP` (last step, post-verification).
7. `docs/reference/decision-logs.md` — append the implemented-D36 entry, retire the deferral notes;
   sync `.env.example` for `SEED_OPERATOR_*`.

## Test matrix

**Unit (`resolveDashCtx` + `assertMember`)** — the leak cases are mandatory:

| Case | Setup | Expect |
|---|---|---|
| verified active-org | user is member of active-org | scoped to active-org |
| stale active-org | active-org set, user member of org B only | scoped to **B** |
| forged active-org | active-org = foreign org, user member of none | **`null`** (the canonical leak test) |
| member fallback | active null, 1 member row | scoped to that org |
| zero-org | no member rows | `null` |
| multi-org | 2 member rows | oldest + warn |
| org no repo | 0 repos | `null` |
| multi-repo | 2 repos | oldest + warn |

**Integration (1-2):** sign in as user A (org A / repo A) → `sessionsFn`/`metricsFn` return A-only;
sign in as user B (foreign org) → B-only, never A. The end-to-end boundary proof; run immediately
before flipping `OVERSTORY_OPEN_SIGNUP`.

## Rollout order

1. Land the resolver + call-site edits + empty-state UI (backward-compatible for dogfood **once the
   seed member row exists**).
2. Extend the seed (operator user + member); add the Vitest suite.
3. Prove isolation with the two-user boundary test.
4. Flip `OVERSTORY_OPEN_SIGNUP=true` — only after a stranger demonstrably resolves to empty.
5. Cleanup: retire C1/D36 deferral comments (`auth/index.ts`, `dashboard.ts`, `_dashboard.tsx`);
   append the decision-log entry.

## Out of scope

`apps/api` (already tenant-safe); the `@overstory/core/dashboard` queries (already `repoId`-scoped);
org-switching UI, invitations, roles/RBAC, repo-picker-as-feature, onboarding flows; the GitHub App
(D27) and credit ledger (D32).
