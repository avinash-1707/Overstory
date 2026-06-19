// Serving — path↔decision lookups + ServeEvent logging. See docs/technical/serving.md.
// context (always-on, D20), guard (file→decisions prevent, D17), decision (read one).
// Every lookup writes a ServeEvent (D28) in the SAME place it serves, so logging the
// agent's consumption is structurally impossible to forget. Cheap reads, no LLM.
import { and, eq, exists, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { decisions, pointers, serveEvents } from '@overstory/db/schema'
import type { Db } from '@overstory/db'
import type { DecisionId, RepoId, ServeQuery, WorkspaceId } from '@overstory/db/schema'
import { normalizePath } from '../paths'

// What a coding agent receives — why + where, never the code itself (D1/D15/D3).
export interface ServedDecision {
  id: DecisionId
  title: string
  statement: string
  why: string // rationale — the head-only value (D18)
  where: { filePath: string; symbol: string | null }[] // pointers (D15)
  status: 'decided' | 'needs_reconfirmation'
  stale: boolean // true when needs_reconfirmation (D11)
}

// Tenant scope (from the ApiKey) + the agent session — carried on every call.
export interface ServeCtx {
  db: Db
  workspaceId: WorkspaceId
  repoId: RepoId // non-optional: no serving query may run unscoped
  sessionId: string
}

type McpTool = 'context' | 'guard' | 'check' | 'decision' | 'search'

// Served states only — 'superseded' (replacement served instead) and 'proposed'
// (not yet confirmed) are never served. See serving.md "Freshness on serve".
const SERVABLE: ('decided' | 'needs_reconfirmation')[] = ['decided', 'needs_reconfirmation']

// Defensive ceiling on the always-on tier so a misconfigured ranking (or a flood of
// high-composite captures) can't dump the whole set into the agent's context (D20 keeps
// this small in practice; the cap is insurance). Highest composite wins if it bites.
const ALWAYS_ON_LIMIT = 50

// Defensive ceiling on the file→decision lookup. A file in a hot directory could match many
// decisions; uncapped, guard would dump them all and check would feed an oversized prompt to
// the judge (truncation + cost risk). Realistic counts are tiny, so this only bites
// pathologically — highest composite wins if it does. Mirrors ALWAYS_ON_LIMIT.
const FILE_MATCH_LIMIT = 50

interface DecisionRow {
  id: DecisionId
  title: string
  statement: string
  rationale: { why: string }
  status: 'proposed' | 'decided' | 'needs_reconfirmation' | 'superseded'
}

const DECISION_COLS = {
  id: decisions.id,
  title: decisions.title,
  statement: decisions.statement,
  rationale: decisions.rationale,
  status: decisions.status,
}

// Pointers hydrated in the SAME query via a LEFT JOIN + json_agg (D35 collapse): the old
// per-call pattern was decisions-query + a separate attachPointers-query (2 hops for context,
// 3 for guard), each a remote Neon round-trip that pushed latency toward the MCP abort. The
// join lets Drizzle TRACK both tables and so QUALIFY the columns ("pointers"."file_path"); a
// correlated subquery referencing ${decisions.id} does NOT work — Drizzle emits the bare,
// unqualified "id" there, which binds to pointers' own id and matches nothing. `filter` drops
// the null row a LEFT JOIN leaves for a decision with no pointers; coalesce → '[]' for it.
// Tenant boundary holds (D34, "Serving tenant scope via the decisions join"): pointers are
// reached only via decision_id, and every query below scopes decisions by repoId, so a
// pointer is never read outside the caller's repo. The postgres driver parses json → array.
const POINTERS_AGG = sql<{ filePath: string; symbol: string | null }[]>`coalesce(
    json_agg(json_build_object('filePath', ${pointers.filePath}, 'symbol', ${pointers.symbol}))
      filter (where ${pointers.decisionId} is not null),
    '[]'::json)`

const SERVE_COLS = { ...DECISION_COLS, pointers: POINTERS_AGG }

// decisions LEFT JOIN pointers, hydrated in one round-trip. Callers add the repo-scoped
// WHERE, then groupBy(decisions.id) (PK → the other selected cols are functionally dependent).
function servingBase(ctx: ServeCtx) {
  return ctx.db
    .select(SERVE_COLS)
    .from(decisions)
    .leftJoin(pointers, eq(pointers.decisionId, decisions.id))
}

interface ServeRow extends DecisionRow {
  pointers: { filePath: string; symbol: string | null }[]
}

// Defensive: never serve a non-servable status even if a caller forgot the WHERE filter
// (toServed would otherwise coerce it to 'decided' — a silent D11/freshness violation).
function mapRows(rows: ServeRow[]): ServedDecision[] {
  return rows
    .filter((r) => r.status === 'decided' || r.status === 'needs_reconfirmation')
    .map((r) => toServed(r, r.pointers ?? []))
}

// Always-on tier (D20): the cross-cutting decisions injected at session start.
export async function getAlwaysOn(ctx: ServeCtx): Promise<ServedDecision[]> {
  const start = Date.now()
  const rows = await servingBase(ctx)
    .where(
      and(
        eq(decisions.repoId, ctx.repoId),
        eq(decisions.alwaysOn, true),
        inArray(decisions.status, SERVABLE),
      ),
    )
    .groupBy(decisions.id)
    .orderBy(sql`(${decisions.ranking} ->> 'composite')::float desc`)
    .limit(ALWAYS_ON_LIMIT)
  const served = mapRows(rows)
  logServe(ctx, 'context', {}, served, start)
  return served
}

// Normalize + dedupe a caller-supplied path list. Idempotent. Shared by guard + check.
export function normalizeFiles(files: string[]): string[] {
  return [...new Set(files.map(normalizePath).filter(Boolean))]
}

// File→decision lookup WITHOUT logging — the shared core of guard (D17) and the
// contradiction check (D11). Returns decisions whose pointers govern any of the files
// (exact match OR an ancestor directory), each hydrated with ALL its loci. starts_with
// (not LIKE) so '_'/'%' in paths can't widen the match, and 'src/auth' never matches
// 'src/authentication.ts'. Callers that surface this to the agent log their own ServeEvent.
export async function findDecisionsByFiles(ctx: ServeCtx, files: string[]): Promise<ServedDecision[]> {
  const normalized = normalizeFiles(files)
  // INVARIANT: return before building fileMatch when empty. or(...[]) → undefined would make
  // the exists() WHERE collapse to the bare decision_id correlation — matching EVERY decision
  // in the repo. Do not remove this early return.
  if (normalized.length === 0) return []

  // A decision is SELECTED when one of its pointers matches a touched file, but is HYDRATED
  // with ALL its loci (the base LEFT JOIN in servingBase) — so selection uses a SEPARATELY
  // aliased pointers table inside exists(), keeping it distinct from the hydration join.
  const matchPtr = alias(pointers, 'match_ptr')
  const fileMatch = or(
    ...normalized.map((f) =>
      or(eq(matchPtr.filePath, f), sql`starts_with(${f}, ${matchPtr.filePath} || '/')`),
    ),
  )
  // Tenant boundary (D34): pointers has no repo_id, so d.repo_id in the WHERE is the ONLY
  // thing scoping this to the caller's repo. The exists() correlates match_ptr to this repo's
  // decisions via decision_id, so the match can't escape the repo. One round-trip (D35).
  const rows = await servingBase(ctx)
    .where(
      and(
        eq(decisions.repoId, ctx.repoId),
        inArray(decisions.status, SERVABLE),
        exists(
          ctx.db
            .select({ n: sql`1` })
            .from(matchPtr)
            .where(and(eq(matchPtr.decisionId, decisions.id), fileMatch)),
        ),
      ),
    )
    .groupBy(decisions.id)
    .orderBy(sql`(${decisions.ranking} ->> 'composite')::float desc`)
    .limit(FILE_MATCH_LIMIT)
  return mapRows(rows)
}

// On-demand guard (D17): the file→decision lookup + a 'guard' ServeEvent.
export async function guardByFiles(ctx: ServeCtx, files: string[]): Promise<ServedDecision[]> {
  const start = Date.now()
  const normalized = normalizeFiles(files)
  const served = await findDecisionsByFiles(ctx, normalized)
  logServe(ctx, 'guard', { files: normalized }, served, start)
  return served
}

// Read one decision in full, repo-scoped. Returns null if absent or not servable.
export async function getDecision(ctx: ServeCtx, id: DecisionId): Promise<ServedDecision | null> {
  const start = Date.now()
  const rows = await servingBase(ctx)
    .where(
      and(eq(decisions.id, id), eq(decisions.repoId, ctx.repoId), inArray(decisions.status, SERVABLE)),
    )
    .groupBy(decisions.id)
    .limit(1)
  const served = mapRows(rows)[0] ?? null
  logServe(ctx, 'decision', { decisionId: id }, served ? [served] : [], start)
  return served
}

function toServed(r: DecisionRow, where: { filePath: string; symbol: string | null }[]): ServedDecision {
  const status = r.status === 'needs_reconfirmation' ? 'needs_reconfirmation' : 'decided'
  return { id: r.id, title: r.title, statement: r.statement, why: r.rationale.why, where, status, stale: status === 'needs_reconfirmation' }
}

// ServeEvent (D28): one row per call, lookup + insert in one place. Best-effort and
// fire-and-forget — callers do NOT await it, so the Neon insert round-trip stays off
// the serving hot path (the MCP client has a tight timeout; an extra ~1s hop per call
// pushed context/guard over it → degrade-open `unavailable`). A logging failure must
// never break the read it describes. D1-safe (ids + query only). The node server keeps
// the event loop alive after responding, so the detached insert still completes.
// Exported so the contradiction check (a separate core module) logs its 'check' event
// through the same path — keeping the "lookup + insert in one place" property (D28).
export function logServe(
  ctx: ServeCtx,
  tool: McpTool,
  query: ServeQuery,
  served: ServedDecision[],
  startMs: number,
  conflicts: ServedDecision[] = [],
): void {
  // Detached + bulletproof. The inner try swallows insert errors; the trailing .catch()
  // guarantees the detached promise can NEVER reject (no unhandled rejection that could
  // crash the process, even if a future edit throws before the try). Returns void so
  // callers can't accidentally leave a floating promise unguarded.
  void (async () => {
    try {
      await ctx.db.insert(serveEvents).values({
        workspaceId: ctx.workspaceId,
        repoId: ctx.repoId,
        sessionId: ctx.sessionId,
        tool,
        query,
        servedDecisionIds: served.map((s) => s.id),
        conflictDecisionIds: conflicts.map((c) => c.id),
        latencyMs: Date.now() - startMs,
      })
    } catch {
      // observability, not correctness — swallow
    }
  })().catch(() => {})
}
