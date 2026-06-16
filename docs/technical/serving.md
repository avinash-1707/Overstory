# Overstory — Serving

> **Status:** Build-phase technical doc. Defines how stored decisions reach a coding agent — the MCP tool surface, two-tier serving (D20), the prevent/catch model (D17), and the PR contradiction check (D11/D27). Reads the entities in `data-model.md`; the write side is `capture-loop.md`.
>
> **Stack:** TypeScript (D21). MCP server via `@modelcontextprotocol/sdk` (stdio for dogfood → HTTP later). Backend Postgres + Drizzle (D26).

---

## Scope of this doc

**Covers:** the MCP tools agents call, the two serving tiers (D20), the prevent/catch division (D17), payload shape (D1/D15/D3), agent-side enforcement, freshness-on-serve, and the GitHub App PR check.

**Defers:** how decisions are produced/ranked → `capture-loop.md`. Entity shapes and the path↔decision index → `data-model.md`.

---

## The serving model: prevent where consulted, catch at review (D17)

Serving is **not** the differentiator (D18) — it's table stakes. The honest framing (D17, Risk 4): MCP is **pull-based**, the agent reads only when it chooses to, and the core failure is that it doesn't _know_ a topic is decision-laden. So serving is built in two layers and two tiers:

| | **Prevent** (generation time) | **Catch** (review time) |
| --- | --- | --- |
| Mechanism | guard query + always-on tier | contradiction check |
| Guarantee | best-effort (agent must consult) | backstop (fires on the diff) |
| Surface | MCP tools | MCP `check` + GitHub App PR check |

Stated honestly: **"prevents where the agent consults before acting; catches the rest at review,"** not "the agent never errs."

The **two tiers** (D20) keep context refined (D3):

- **Always-on tier** — the few `alwaysOn` decisions, injected at session start regardless of task. Steers fuzzy tasks before files are chosen, and means the agent need not _know to ask_ for the highest-stakes decisions (partly fixes Risk 4).
- **On-demand tier** — the guard query: `file → decisions`, returned only for the locus the agent is touching.

Never the full decision set. Always-on is tiny; on-demand is locus-filtered.

---

## Connection & auth (D26)

- **MCP server** runs as a thin client to the backend. Dogfood: stdio (`npx @overstory/mcp`), configured in Claude Code / Cursor. Later: hosted HTTP/SSE.
- **Auth:** an `ApiKey` (D26) scoped to a workspace + repo, supplied in the MCP server config. Every tool call is workspace+repo-scoped server-side.
- **Repo identity:** the configured key binds the session to one `Repo`; path lookups are relative to that repo's normalized paths.

---

## MCP tool surface

Four tools (plus an optional `search`). Each `description` is written to _prompt the agent to call it at the right moment_ — the descriptions are part of the prevent mechanism (D17).

### `overstory_context` — always-on tier (D20)

```ts
{
  name: 'overstory_context',
  description:
    "Fetch Overstory's always-on architectural decisions for this repo. " +
    "Call once at the START of any task, before planning changes — these are " +
    "the cross-cutting decisions that shape where and how you should work.",
  inputSchema: { type: 'object', properties: {} },          // repo bound by API key
}
// → ServedDecision[]  (the alwaysOn=true, status=decided set; small)
```

### `overstory_guard` — on-demand prevent (D17)

```ts
{
  name: 'overstory_guard',
  description:
    "BEFORE editing files, call this with the paths you are about to change " +
    "to get the recorded decisions and rationale governing them. Read these " +
    "before choosing an approach, so you don't undo an intentional design.",
  inputSchema: {
    type: 'object',
    properties: { files: { type: 'array', items: { type: 'string' } } },
    required: ['files'],
  },
}
// → ServedDecision[]  (decisions whose pointers match any of the paths, incl. directory scope)
```

### `overstory_check` — agent-side catch (D11)

```ts
{
  name: 'overstory_check',
  description:
    "Check a proposed change against recorded decisions before finalizing it. " +
    "Pass the files you changed and a short summary of what you did.",
  inputSchema: {
    type: 'object',
    properties: {
      files: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
    },
    required: ['files', 'summary'],
  },
}
// → { conflicts: { decisionId, title, detail }[] }   (uses detectContradiction, capture-loop.md)
```

### `overstory_decision` — read one in full

```ts
{
  name: 'overstory_decision',
  description: "Read a single Overstory decision in full (statement, rationale, pointers).",
  inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
}
// → ServedDecision (full)
```

### `overstory_search` — fuzzy task → decisions (optional; the #7 remainder)

```ts
{
  name: 'overstory_search',
  description:
    "Find decisions relevant to a task when you don't yet know which files " +
    "you'll touch. Pass a short description of what you're about to build.",
  inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
}
// → ServedDecision[]  (ranked by topic match; bridges fuzzy-goal → decisions before a locus exists)
```

The always-on tier handles the highest-stakes steering for free; `search` is the targeted fallback for a fuzzy task whose decisions aren't in the always-on set.

---

## Payload shape (D1 / D15 / D3)

What a served decision contains — **why + where, never the what (code).**

```ts
interface ServedDecision {
  id: DecisionId
  title: string
  statement: string                         // what was decided
  why: string                               // rationale — the head-only value (D18)
  where: { filePath: string; symbol: string | null }[]  // pointers (D15)
  status: 'decided' | 'needs_reconfirmation'
  stale: boolean                            // true when needs_reconfirmation
}
```

The agent gets **why** (rationale) + **where** (pointer) in a small payload, then reads **live code** at `where` itself (D1/D15 — navigation, not caching; never stale). No code bytes cross the serving boundary. Payloads stay small to preserve refined context (D3).

---

## The path → decision lookup

From the index in `data-model.md`:

```sql
-- exact file
SELECT d.* FROM decisions d
JOIN pointers p ON p.decision_id = d.id
WHERE p.file_path = $1 AND d.status IN ('decided','needs_reconfirmation');

-- directory scope (a decision governing a whole module)
... WHERE p.file_path LIKE $1 || '/%' ...
```

- **Exact + directory-prefix** matching; a decision pointed at a directory governs files beneath it.
- Drifted pointers (`driftStatus = 'drifted'`) are re-resolved before serving or flagged; `superseded` decisions are never served (their replacement is).

---

## Agent-side enforcement (D17, Risk 4)

Prevention is best-effort — the agent must actually consult. Two reinforcing nudges:

1. **Tool descriptions** (above) are written as instructions ("BEFORE editing… call this").
2. **A project rule** in the repo — `CLAUDE.md` / `.cursor/rules` / `AGENTS.md`:
   > _Before editing any file, call `overstory_guard` with the paths you're about to change and follow the recorded decisions. At task start, call `overstory_context`._

Neither guarantees the call (Risk 4). The **always-on tier is the backstop for prevention** (it arrives without being asked), and the **PR check is the backstop for catch**. Watch during dogfood: how often does the agent call `guard` unprompted? If rarely, Overstory is a review-time linter, not a generation-time guardrail — and positioning must match (Risk 4).

---

## Freshness on serve

| Decision status | Served? | How |
| --- | --- | --- |
| `decided` | yes | normally |
| `needs_reconfirmation` | yes, **flagged** | `stale: true` — agent still sees it, knows it's pending re-confirm (D11) |
| `superseded` | no | the replacement is served instead |
| `proposed` | no | not yet a confirmed decision |

---

## PR contradiction check (D11 / D27)

The catch backstop, server-side, when the agent skipped the guard query:

```
PR opened ──webhook──▶ GitHub App (read-only, D27)
   for each changed file → path→decision lookup
   → detectContradiction(diff, decision)   (cheap triage → Opus confirm; capture-loop.md)
   → on conflict: post a PR check / comment
                  + create ContradictionEvent, set decision → needs_reconfirmation
```

- **Read-only** access (D27); least-privilege scopes.
- Posts a non-blocking check by default (a flag, not a gate) — the dev decides reconfirm vs supersede.
- This is where freshness (D11) actually fires for most real changes, given the pull-based prevent layer is best-effort.

---

## Serving flow (end to end)

```
session start ─▶ overstory_context        (always-on tier, steers planning)
     │
  task given
     │  (fuzzy, no files yet?) ─▶ overstory_search(query)   (optional)
     ▼
  locate files ─▶ overstory_guard(files)   (decisions on the locus — PREVENT)
     ▼
  read live code at pointers ─▶ choose approach (now informed by the why)
     ▼
  make change ─▶ overstory_check(files, summary)   (optional agent-side CATCH)
     ▼
  open PR ─▶ GitHub App contradiction check        (backstop CATCH, D11/D27)
```

---

## Cost & performance

- Serving is **cheap reads** — no LLM on `context` / `guard` / `decision` / `search` (pure index queries).
- LLM cost only on contradiction judgment (`check` + PR check), and that's cheap-triage-first (capture-loop.md).
- Cache the always-on tier per repo; invalidate when an `alwaysOn` decision changes.

---

## Open questions

1. **Directory-scope matching rules** — exact prefix semantics, and how a directory-scoped decision interacts with a more specific file-scoped one (most-specific wins?).
2. **Getting the agent to call `guard`** (Risk 4) — measure unprompted consult rate; if low, lean harder on always-on + PR check, and adjust positioning.
3. **`search` ranking** — topic/embedding match quality for the fuzzy-task path; is it worth building beyond the always-on tier?
4. **PR check noise** — non-blocking vs blocking, and false-positive rate (ties contradiction precision, D11).
5. **Monorepo / multi-repo** — one API key per repo vs workspace-wide serving across linked repos.
