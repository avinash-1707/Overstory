# Overstory — Data Model

> **Status:** Build-phase technical doc. Defines the entities Overstory stores, how they relate, their lifecycle, and the derived index that powers serving. This is the foundation `capture-loop.md` and `serving.md` build on.
>
> **Stack:** TypeScript (D21), Postgres + Drizzle (D26), hosted cloud store (D23). Type sketches below are illustrative interfaces; each maps to a Drizzle table.

---

## Scope of this doc

**Covers:** the entities (Decision, Flow, Pointer, AnalysisArtifact, Provocation, ContradictionEvent), their relationships, the path↔decision index, the decision lifecycle, freshness/invalidation rules, and tenancy.

**Defers:** _how_ provocations are generated and ranked, and the accept/reject UX → `capture-loop.md`. The MCP tool surface and serving tiers → `serving.md`. (This doc defines the data those two read and write.)

---

## Design constraints this model must satisfy

| Constraint | From | How the model honors it |
| --- | --- | --- |
| Store rationale, never code | D1 | No code-content column anywhere. Pointers store _addresses_; AnalysisArtifact stores _understanding_. |
| Decision = scoped to a flow **and** carries file pointers | D22 | `Decision.flowId` (human scope) + `Pointer[]` (machine locus). |
| Pointers are durable, drift-detectable | D15 | Symbol/anchor pointers preferred over line numbers; `driftStatus` + `lastResolvedSha`. |
| One path↔decision index, both directions | D17, D20 | Derived from the `pointers` table; `file→decisions` and `decision→files` are both indexed queries. |
| Deep analysis is a **separate, append-only layer** | D16 | `AnalysisArtifact` is its own entity, versioned, never served to agents. |
| Freshness via contradiction events, not erosion detection | D11 | `ContradictionEvent` + `status: needs_reconfirmation`. |
| Supersede, never delete | D11, log convention | `supersedesId` / `supersededById`; status `superseded`. |
| Ranking drives the vital few + always-on tier | D19, D20 | `Decision.ranking` + derived `alwaysOn`. |
| Multi-tenant cloud store | D23, D26 | `Workspace → Repo → Flow → Decision`; row-scoped by `workspaceId`. |
| Provenance for seeded rationale | D18 | `Decision.provenance` records the retrievable sources a draft was seeded from. |
| Repo read access for cloud capture | D27 | `RepoAccess` (read-only GitHub App); app key in KMS, short-lived tokens minted on demand. |

---

## Entity overview

```
Workspace (Better Auth org)
  └── Repo
        ├── RepoAccess (GitHub App install, read-only — D27)
        ├── Flow ───────────────┐
        │     ├── AnalysisArtifact (append-only versions)   ← engine layer, NOT served
        │     └── Decision ──────┤
        │            ├── Pointer[]            (file-level loci, D15/D22)
        │            ├── Provocation[]        (capture history)
        │            └── ContradictionEvent[] (freshness, D11)
        └── ApiKey[] (MCP + CLI auth, workspace/repo-scoped)
```

Two layers, kept apart on purpose (D16):

- **Engine layer** — `AnalysisArtifact`. The deep understanding that makes provocations credible. Internal; never returned over MCP.
- **Served layer** — `Decision` + `Pointer` + rationale. The commodity artifact (D18) agents read.

---

## Entities

IDs are branded strings (ULID) to prevent cross-entity mixups:

```ts
type WorkspaceId = string & { readonly _t: 'WorkspaceId' }
type RepoId      = string & { readonly _t: 'RepoId' }
type FlowId      = string & { readonly _t: 'FlowId' }
type DecisionId  = string & { readonly _t: 'DecisionId' }
type PointerId   = string & { readonly _t: 'PointerId' }
```

### Workspace & Repo (tenancy)

```ts
interface Workspace {
  id: WorkspaceId            // Better Auth organization
  name: string
  createdAt: Date
}

interface Repo {
  id: RepoId
  workspaceId: WorkspaceId
  name: string               // e.g. "kakiyo"
  remoteUrl: string | null   // accessed read-only via GitHub App (D27) for cloud capture + seeding
  primaryLanguage: 'typescript'  // one-ecosystem-first (D9/D21)
  createdAt: Date
}

interface RepoAccess {              // GitHub App installation (D27) — read-only, least-privilege
  id: string
  repoId: RepoId
  provider: 'github'
  installationId: string           // identifies the install; tokens minted on demand, none stored per-repo
  scopes: string[]                 // ['contents:read', 'pull_requests:read'] — least privilege
  connectedAt: Date
}
```

**Credential handling (security).** The only long-lived secret is the GitHub App's private key, held in a KMS / secret manager — **never in Postgres**. Per repo we store just the `installationId`; short-lived (~1h) installation access tokens are minted on demand from the app key and never persisted. Scopes are least-privilege and read-only.

### Flow (scope unit)

```ts
interface Flow {
  id: FlowId
  repoId: RepoId
  name: string               // "inbound message → AI pipeline"
  description: string        // human-readable summary of what the flow is
  currentAnalysisId: AnalysisArtifactId | null  // latest engine understanding
  createdAt: Date
}
```

A flow is how a human reasons about a slice of the system (D12). Decisions hang off flows; pointers connect them to files.

### Decision (core, served unit)

```ts
type DecisionStatus = 'proposed' | 'decided' | 'needs_reconfirmation' | 'superseded'
type CaptureMethod  = 'provoked' | 'seeded_confirmed' | 'manual'

interface Decision {
  id: DecisionId
  repoId: RepoId
  flowId: FlowId                     // scope (D22)
  title: string                      // "Auth is split: widget JWT vs dashboard BetterAuth"
  statement: string                  // what was decided, precisely
  status: DecisionStatus

  rationale: Rationale               // the WHY — the head-only slice we extracted (D18)
  alternativesConsidered: string[]   // the provoking alternatives + why rejected (optional)

  pointers: Pointer[]                // every locus this decision governs (D15/D22)
  topics: string[]                   // tags for targeted always-on injection (D20, optional)

  ranking: DecisionRanking           // D19
  alwaysOn: boolean                  // derived: top slice of ranking → always-on tier (D20)

  provenance: Provenance | null      // retrievable sources the draft was seeded from (D18)
  captureMethod: CaptureMethod

  supersedesId: DecisionId | null    // points back at the decision this replaces (D11)
  supersededById: DecisionId | null  // set when a newer decision replaces this one

  createdBy: string                  // Better Auth user id
  createdAt: Date
  updatedAt: Date
  lastConfirmedAt: Date              // bumped on reconfirmation (freshness signal)
}

interface Rationale {
  why: string                        // the reasoning, in the dev's words
  capturedFrom: 'reject' | 'accept' | 'seed_confirmed'  // how it entered (D4 / glossary)
}

interface DecisionRanking {          // D19 — drives vital-few selection + alwaysOn
  nonObviousness: number             // 0–1: would an agent get this wrong by default?
  blastRadius: number                // 0–1: how cross-cutting / high-impact
  bannedDefaultProximity: number     // 0–1: is there a tempting wrong default nearby?
  composite: number                  // weighted combination; sort key for provocation budget
}

interface Provenance {               // D18 seeding
  commitShas: string[]
  prUrls: string[]
  ticketUrls: string[]
  note: string | null                // what was inferable vs the head-only delta the human added
}
```

Rationale is embedded for now. If rationale needs its own edit history later, promote it to a versioned table — the contradiction/supersede machinery already gives us the hooks.

### Pointer (code reference, not code storage — D15)

```ts
type PointerKind   = 'file' | 'symbol' | 'anchor'
type DriftStatus   = 'fresh' | 'drifted' | 'unresolved'

interface Pointer {
  id: PointerId
  decisionId: DecisionId
  kind: PointerKind
  filePath: string                   // normalized, repo-relative
  symbol: string | null              // e.g. "AuthMiddleware.verify" (resolved via ts-morph)
  anchorHint: string | null          // durable text anchor when no symbol applies
  lastResolvedSha: string            // commit at which this pointer last resolved cleanly
  driftStatus: DriftStatus
}
```

**No line numbers as the primary anchor** (D15 / pointer-drift): symbol-based anchors survive refactors; line numbers don't. `ts-morph` resolves symbols at capture time and at re-resolution.

### AnalysisArtifact (engine layer — D16, never served)

```ts
type AnalysisArtifactId = string & { readonly _t: 'AnalysisArtifactId' }

interface AnalysisArtifact {
  id: AnalysisArtifactId
  flowId: FlowId
  version: number                    // append-only; new version on incremental refine
  supersedesVersionId: AnalysisArtifactId | null
  content: AnalysisContent           // structured flow understanding (JSONB)
  seededFrom: Provenance | null      // sources read to build it (D18)
  createdAt: Date
}

interface AnalysisContent {
  summary: string
  components: { name: string; role: string; pointers: string[] }[]
  dataFlow: string                   // how data moves through the flow
  observedInvariants: string[]       // cross-cutting rules the engine noticed
  candidateDecisions: CandidateDecision[]  // raw material the capture loop ranks/provokes on
}

interface CandidateDecision {
  statement: string
  whyItMightBeIntentional: string
  plausibleAlternative: string       // seed for a provocation (D16 plausibility, not correctness)
  estimatedRanking: DecisionRanking
}
```

**This is the means, not the value (D16).** It feeds provocation generation; it is never returned to a coding agent. It is append-only so we refine understanding without re-deriving wholesale (D7/D8).

### Provocation (capture history)

```ts
type ProvocationOutcome = 'accepted' | 'rejected_with_reason' | 'pending'

interface Provocation {
  id: string
  flowId: FlowId
  decisionId: DecisionId | null      // the decision it produced/confirmed, if any
  alternative: string                // the provoking "you could do X instead"
  tradeoffs: string
  outcome: ProvocationOutcome
  producedRationale: string | null   // the "no, because Y" we captured
  createdAt: Date
}
```

Kept slim here; generation/ranking logic lives in `capture-loop.md`. The record persists so we can audit what was asked and avoid re-provoking settled ground.

### ContradictionEvent (freshness — D11)

```ts
type ContradictionTrigger    = 'agent_edit' | 'pr' | 'manual'
type ContradictionResolution = 'still_true' | 'superseded' | 'pending'

interface ContradictionEvent {
  id: string
  decisionId: DecisionId
  trigger: ContradictionTrigger
  detail: string                     // summary of the change that contradicts the decision
  changedFiles: string[]             // how it was matched to the decision (via the index)
  detectedAt: Date
  resolution: ContradictionResolution
  resolvedDecisionId: DecisionId | null  // the new decision, if superseded
}
```

---

## The path↔decision index (D17 / D20)

Both serving directions derive from the `pointers` table — no separate store, just indexed queries:

```sql
-- file → decisions  (guard query, contradiction check)
SELECT decision_id FROM pointers WHERE file_path = $1;          -- exact file
SELECT decision_id FROM pointers WHERE file_path LIKE $1 || '%'; -- directory scope

-- decision → files  (navigation, D15)
SELECT file_path, symbol FROM pointers WHERE decision_id = $1;

-- always-on tier  (D20)
SELECT * FROM decisions
WHERE repo_id = $1 AND always_on = true AND status = 'decided';
```

Indexes: `pointers(file_path)`, `pointers(decision_id)`, `decisions(repo_id, always_on, status)`.

- **On-demand tier** = the `file → decisions` query, fed the files the agent is touching (guard query).
- **Always-on tier** = `always_on = true` decisions for the repo, injected at session start.
- `always_on` is set when `ranking.composite` clears a threshold (the top slice of the vital few, D19) — recomputed when a decision's ranking changes.

---

## Decision lifecycle

```
        provocation pending
                │
                ▼
   ┌────────  proposed  ──────────┐
   │  accept / reject-with-reason │
   ▼                              │
 decided ◀───────────────────────┘
   │   ▲
   │   │ reconfirm (still_true):
   │   │ lastConfirmedAt bumped
   ▼   │
 needs_reconfirmation  ◀── ContradictionEvent fires (D11)
   │
   │ superseded: new Decision created,
   │ old.supersededById set, status → superseded
   ▼
 superseded   (never deleted — D11 / log convention)
```

- A decision is **served only in `decided`** status. `needs_reconfirmation` is still served but flagged stale; `superseded` is never served (its replacement is).
- Reconfirmation is cheap (bump `lastConfirmedAt`); supersession creates a new row and links it.

---

## Freshness & invalidation rules

| Trigger | Detect | Effect | Decision |
| --- | --- | --- | --- |
| File rename/move/symbol relocation | diff or failed re-resolution | `Pointer.driftStatus = 'drifted'` → re-resolve via ts-morph → update `lastResolvedSha` or mark `unresolved` (flag human) | D15 |
| Change contradicts a decision | contradiction check (agent edit / PR) | create `ContradictionEvent`; `Decision.status = 'needs_reconfirmation'` | D11 |
| Decision genuinely changes | human supersedes | new Decision; old → `superseded` | D7, D11 |
| Ordinary code edit (no contradiction) | — | **nothing** — rationale is stable; we don't re-derive per diff | D6, D7 |

Pointer drift is a **cheap, diff-detectable** invalidation (D15). Decision erosion has no diff — it only surfaces via contradiction events (D11, and the standing open Risk 1).

---

## Tenancy & storage (D23 / D26)

- **Hierarchy:** `Workspace → Repo → Flow → {Decision, AnalysisArtifact}`; `Decision → {Pointer, Provocation, ContradictionEvent}`.
- **Isolation:** every row carries `workspaceId` (directly or via FK chain); all queries are workspace-scoped.
- **Auth:** Better Auth (organizations = workspaces, users = members). `ApiKey` rows authenticate the MCP server and the CLI, scoped to a workspace + repo.
- **Repo access:** `RepoAccess` stores the GitHub App installation per repo (D27); short-lived tokens minted from a KMS-held app key, never stored in Postgres.
- **Engine vs served separation:** `AnalysisArtifact` lives in the same Postgres but is never exposed through the serving API — only the capture loop reads/writes it.

---

## Explicitly NOT stored (D1)

- **No code contents.** Anywhere. Not in `Decision`, not in `AnalysisArtifact`.
- `AnalysisArtifact.content` holds _understanding_ (prose/structured), not source.
- `Pointer` holds _addresses_ (path/symbol/anchor), not the bytes at them.
- Code snippets **transit** the backend for the managed LLM call (D25) and for cloud capture (D27) but are **not persisted** — consistent with D1.
- **No long-lived repo credentials.** Only the GitHub App `installationId` is stored (D27); short-lived tokens are minted on demand from a KMS-held app key, never persisted.

---

## Open questions (resolve in `capture-loop.md` / `serving.md`)

1. **Ranking weights** — how `composite` combines the three signals, and the `alwaysOn` threshold. → `capture-loop.md`.
2. **Directory-scope matching** — exact `file_path` prefix rules for decisions that govern a whole module. → `serving.md`.
3. **Rationale versioning** — embed vs promote to a versioned table once rationale gets edited post-capture.
4. **Cross-flow decisions** — a decision that genuinely spans flows (e.g. a repo-wide convention): allow `flowId` to be a special "repo-global" flow, or model many-to-many? Leaning repo-global flow to keep the scope model simple.
