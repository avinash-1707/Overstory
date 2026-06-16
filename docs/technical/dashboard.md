# Overstory — Dashboard

> **Status:** Build-phase technical doc. Defines the human web surface — the **Activity dashboard** (visualize what the coding agent pulled over MCP) and the **capture client** (answer provocations), one app. Reads the entities in `data-model.md`; the serve side it observes is `serving.md`; the capture side it drives is `capture-loop.md`.
>
> **Stack:** TypeScript (D21). **TanStack Start** full-stack React for the web app (D29). Reads the backend via a shared Drizzle data layer (D26); machine clients stay on Hono. Better Auth session for humans.

---

## Why this exists (not UI candy)

The dashboard is the **dogfood instrument** for the two unproven things in `open-risks-and-validations.md`:

- **Risk 4 — does the agent consult `guard` before editing?** MCP is pull-based; prevention is best-effort. The only honest way to know if prevent fires is to **log every MCP call and measure**. The dashboard is that measurement.
- **Risk 3A — serve signal.** "Does the agent stop re-making banned choices once decisions are stored?" needs a number: which decisions get pulled, how often, and what got caught at review.

So the dashboard does double duty (D28): a **transparency viewer** ("here's exactly what your agent saw") and an **instrumentation panel** ("is prevent actually working?"). Both are co-equal in the MVP.

---

## Scope of this doc

**Covers:** the one web app and its views, the **Activity dashboard** (metrics + per-session viewer), the data source (`ServeEvent`, defined in `data-model.md`), how each metric is derived, and the frontend architecture.

**Defers:** the `ServeEvent` shape and index → `data-model.md`. What the MCP tools return → `serving.md`. The provocation answer UX → `capture-loop.md` (Stage 6).

---

## One app, four views

A single Better Auth'd web app (workspace-scoped). The dashboard is two of its views; the capture client is the others — no second app (D28).

| View | Job | Reads / writes |
| --- | --- | --- |
| **Activity** | the dashboard — what the agent pulled + is prevent working | `ServeEvent`, `ContradictionEvent` |
| **Sessions** | per-session transparency — the exact context one agent run got | `ServeEvent` grouped by `sessionId` |
| **Decisions** | browse the served corpus (statement, why, pointers, status) | `Decision`, `Pointer` |
| **Provocations** | the capture queue — answer pending provocations (D4) | `Provocation`, writes `Decision` |
| **Flows** | the flow map + per-flow analysis status | `Flow`, `AnalysisArtifact` (status only) |

Activity + Sessions are the dashboard proper; the rest are the capture/corpus surface this doc shares an app with.

---

## Data source: `ServeEvent` (D28)

The dashboard shows nothing unless every MCP tool call is logged. Each call to `overstory_context / guard / check / decision / search` writes one `ServeEvent` server-side (the Hono serving handler does the lookup **and** the insert — see `serving.md`). Shape + index live in `data-model.md`; the essentials:

- `sessionId` — groups calls within one agent session (one MCP connection). The timeline unit.
- `tool` + `query` — what the agent asked (files / summary / id / query string).
- `servedDecisionIds` — what came back. `conflictDecisionIds` — non-empty when `check` flagged a conflict.
- `createdAt`, `latencyMs`.

**D1-safe:** a `ServeEvent` stores decision **IDs** + query **metadata** (file paths the agent named), never code. The Sessions view reconstructs each payload **live** from the current `Decision` (IDs → render), so there's no payload duplication. Fidelity caveat: live reconstruction shows the decision *as it is now*, not a point-in-time snapshot — acceptable because rationale is stable (D6) and the dogfood window is short. Point-in-time payload snapshotting is deferred (see Open questions).

---

## Activity view — the metrics

Every metric maps to a risk or a value signal. Nothing decorative.

| Metric | What it answers | Derivation |
| --- | --- | --- |
| **Consult-rate** _(headline, Risk 4)_ | how often the agent ran `guard` on decision-bearing files *before* a change landed | join `ServeEvent(tool='guard')` against PR-touched files (from `ContradictionEvent.changedFiles` / PR diffs): of runs that touched files with decisions, what % issued a covering guard call |
| **Always-on injections** | did the session start consult fire | count `ServeEvent(tool='context')` per session — one expected at start |
| **Guard calls** | on-demand prevent volume + which paths | count `ServeEvent(tool='guard')`, group by file |
| **Agent-side catches** | did `check` flag before finalize | `ServeEvent(tool='check')` with non-empty `conflictDecisionIds` |
| **PR-time catches** _(backstop, D11)_ | conflicts caught at review when guard was skipped | `ContradictionEvent(trigger='pr')` |
| **Coverage gap** | files the agent touched that have **no** decision → capture candidates | touched files (guard queries + PR diffs) minus files present in `pointers` |
| **Most-served decisions** _(value signal)_ | are stored decisions actually used | rank `Decision` by count in `servedDecisionIds` |
| **Stale served** | how often `needs_reconfirmation` decisions went out flagged | `ServeEvent` whose served set includes a stale decision (D11) |

**The consult-rate is the existential number.** If it's low, Overstory is a review-time linter (catch), not a generation-time guardrail (prevent) — and positioning must follow the data (Risk 4). The dashboard exists mainly to surface this honestly.

---

## Sessions view — per-session transparency

Pick a `sessionId` → a timeline of exactly what that agent run received:

```
session 0JX… (2026-06-16 14:02, repo: kakiyo)
 │
 ├─ context              → 3 always-on decisions   [expand → why+where each]
 ├─ guard(["src/auth/middleware.ts"])
 │      → Decision "Auth split: widget JWT vs dashboard BetterAuth"  [why+where]
 ├─ (agent reads live code at pointer, chooses approach)
 ├─ check(files, "added /v2 login endpoint")
 │      → conflict: "new endpoint uses dashboard auth on a widget path"  ⚠
 └─ decision(D…)         → full read
```

- Each call expands to the **served payload** (why + where), rendered live from current decisions; pointers are clickable into the Decisions view.
- Conflicts (from `check`) and stale flags render inline.
- This is the "here's exactly what your agent saw" answer — the audit/trust half of the MVP.

---

## Frontend architecture (D29)

**TanStack Start** for the web app. Hono is **not** replaced — the split is by client kind:

```
apps/
  web/        TanStack Start  — HUMAN UI: Activity, Sessions, Decisions, Provocations, Flows
                              server functions read/write via packages/db (Drizzle)
  api/        Hono            — MACHINE clients: MCP server backend, CLI, GitHub App webhooks
packages/
  db/         Drizzle schema + queries  (the ONE data layer, shared by web + api)
  mcp/        @overstory/mcp  — thin MCP client → api
```

- **No duplicated business logic.** Web server functions and the Hono API both go through `packages/db`. The serving lookups + `ServeEvent` inserts live in shared query functions, called by the Hono serving handlers (machine path) and read by the web app (human path).
- **Hono stays** because MCP, CLI, and GitHub webhooks are machine clients — they don't want a React framework. TanStack Start owns only the human surface.
- **Auth:** Better Auth session for the web app; `ApiKey` (D26) for the MCP/CLI path — same Better Auth backend, two credential kinds.
- Monorepo (pnpm workspaces / Turbo). Web deploy: TanStack Start (Nitro) on Fly/Railway; same Neon Postgres.

---

## Cost & performance

- **Logging is a cheap insert** per MCP call — no LLM, off the hot path (fire-and-forget or same-tx, tune later). Keeps serving "cheap reads" (`serving.md`).
- **Dashboard reads are index queries** over `ServeEvent` (+ `ContradictionEvent`). Add `serve_events(repo_id, created_at)` and `serve_events(session_id)` indexes.
- Metric aggregations are small at dogfood scale; pre-aggregate later if the event table grows.

---

## Open questions

1. **Consult-rate denominator** — "runs that touched decision-bearing files" is cleanest from PR diffs (full file set) but the MCP server only sees files the agent *named* in queries. Settle whether the rate is computed per-PR (accurate, needs the diff) or per-session (cheaper, biased). Likely per-PR via the GitHub App.
2. **Session identity** — stdio MCP gives one connection = one session; confirm the MCP server mints a stable `sessionId` and that it survives reconnects within a task.
3. **Point-in-time payload fidelity** — live reconstruction vs snapshotting the served payload. Deferred; revisit if decisions churn enough mid-window to make the Sessions view misleading.
4. **Retention** — how long to keep `ServeEvent` rows (every agent call is one). Fine unbounded at dogfood; needs a TTL / rollup before multi-tenant scale.
5. **Live stream vs historical** — MVP is historical + a recent-activity list. A live "watch the agent consult in real time" stream is polish; worth it only if it sharpens the Risk-4 read.
