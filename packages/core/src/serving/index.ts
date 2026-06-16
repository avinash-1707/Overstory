// Serving — path↔decision lookups + ServeEvent logging. See docs/technical/serving.md.
// context (always-on, D20), guard (file→decisions prevent, D17), decision (read one).
// Every lookup writes a ServeEvent (D28) in the SAME place it serves, so logging the
// agent's consumption is structurally impossible to forget. Cheap reads, no LLM.
import { and, eq, inArray, or, sql } from 'drizzle-orm'
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

// Always-on tier (D20): the cross-cutting decisions injected at session start.
export async function getAlwaysOn(ctx: ServeCtx): Promise<ServedDecision[]> {
  const start = Date.now()
  const rows = await ctx.db
    .select(DECISION_COLS)
    .from(decisions)
    .where(
      and(
        eq(decisions.repoId, ctx.repoId),
        eq(decisions.alwaysOn, true),
        inArray(decisions.status, SERVABLE),
      ),
    )
    .orderBy(sql`(${decisions.ranking} ->> 'composite')::float desc`)
    .limit(ALWAYS_ON_LIMIT)
  const served = await attachPointers(ctx, rows)
  await logServe(ctx, 'context', {}, served, start)
  return served
}

// On-demand guard (D17): decisions whose pointers govern any of the touched files —
// exact match OR an ancestor directory of the file. starts_with (not LIKE) so '_'/'%'
// in paths can't widen the match, and 'src/auth' never matches 'src/authentication.ts'.
export async function guardByFiles(ctx: ServeCtx, files: string[]): Promise<ServedDecision[]> {
  const start = Date.now()
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))]
  if (normalized.length === 0) {
    await logServe(ctx, 'guard', { files: normalized }, [], start)
    return []
  }

  const fileMatch = or(
    ...normalized.map((f) =>
      or(eq(pointers.filePath, f), sql`starts_with(${f}, ${pointers.filePath} || '/')`),
    ),
  )
  // Tenant boundary: pointers has no repo_id, so the decisions join + d.repo_id is the
  // ONLY thing scoping this to the caller's repo. Select distinct ids through the join,
  // then hydrate — avoids DISTINCT over the jsonb rationale column.
  const idRows = await ctx.db
    .selectDistinct({ id: decisions.id })
    .from(decisions)
    .innerJoin(pointers, eq(pointers.decisionId, decisions.id))
    .where(and(eq(decisions.repoId, ctx.repoId), inArray(decisions.status, SERVABLE), fileMatch))
  const ids = idRows.map((r) => r.id)
  if (ids.length === 0) {
    await logServe(ctx, 'guard', { files: normalized }, [], start)
    return []
  }

  const rows = await ctx.db.select(DECISION_COLS).from(decisions).where(inArray(decisions.id, ids))
  const served = await attachPointers(ctx, rows)
  await logServe(ctx, 'guard', { files: normalized }, served, start)
  return served
}

// Read one decision in full, repo-scoped. Returns null if absent or not servable.
export async function getDecision(ctx: ServeCtx, id: DecisionId): Promise<ServedDecision | null> {
  const start = Date.now()
  const rows = await ctx.db
    .select(DECISION_COLS)
    .from(decisions)
    .where(
      and(eq(decisions.id, id), eq(decisions.repoId, ctx.repoId), inArray(decisions.status, SERVABLE)),
    )
    .limit(1)
  const served = (await attachPointers(ctx, rows))[0] ?? null
  await logServe(ctx, 'decision', { decisionId: id }, served ? [served] : [], start)
  return served
}

// Hydrate decisions with their code pointers (one extra query, grouped in memory).
async function attachPointers(ctx: ServeCtx, rows: DecisionRow[]): Promise<ServedDecision[]> {
  // Defensive: never serve a non-servable status even if a caller forgot the filter
  // (toServed would otherwise coerce it to 'decided' — a silent D11/freshness violation).
  const servable = rows.filter((r) => r.status === 'decided' || r.status === 'needs_reconfirmation')
  if (servable.length === 0) return []
  const ids = servable.map((r) => r.id)
  const ptrs = await ctx.db
    .select({ decisionId: pointers.decisionId, filePath: pointers.filePath, symbol: pointers.symbol })
    .from(pointers)
    .where(inArray(pointers.decisionId, ids))

  const byDecision = new Map<string, { filePath: string; symbol: string | null }[]>()
  for (const p of ptrs) {
    const list = byDecision.get(p.decisionId) ?? []
    list.push({ filePath: p.filePath, symbol: p.symbol })
    byDecision.set(p.decisionId, list)
  }
  return servable.map((r) => toServed(r, byDecision.get(r.id) ?? []))
}

function toServed(r: DecisionRow, where: { filePath: string; symbol: string | null }[]): ServedDecision {
  const status = r.status === 'needs_reconfirmation' ? 'needs_reconfirmation' : 'decided'
  return { id: r.id, title: r.title, statement: r.statement, why: r.rationale.why, where, status, stale: status === 'needs_reconfirmation' }
}

// ServeEvent (D28): one row per call, lookup + insert in one place. Best-effort —
// a logging failure must never break the read it describes. D1-safe (ids + query only).
async function logServe(
  ctx: ServeCtx,
  tool: McpTool,
  query: ServeQuery,
  served: ServedDecision[],
  startMs: number,
): Promise<void> {
  try {
    await ctx.db.insert(serveEvents).values({
      workspaceId: ctx.workspaceId,
      repoId: ctx.repoId,
      sessionId: ctx.sessionId,
      tool,
      query,
      servedDecisionIds: served.map((s) => s.id),
      conflictDecisionIds: [],
      latencyMs: Date.now() - startMs,
    })
  } catch {
    // observability, not correctness — swallow
  }
}
