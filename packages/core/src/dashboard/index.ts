// Dashboard reads — aggregate + timeline queries over ServeEvent + Decision/Pointer for
// the human UI (D28/D29). Mirrors serving/index.ts: the ONE shared data layer, called by
// apps/web server functions (human path) just as serving is called by Hono (machine path).
// Read-only here — no ServeEvent writes. Tenant scope is the repo (DashCtx.repoId) on
// EVERY query, the human analog of ServeCtx + the D34 boundary (decisions.repo_id).
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { decisions, pointers, serveEvents } from '@overstory/db/schema'
import type { Db } from '@overstory/db'
import type { DecisionId, RepoId, ServeEventId, ServeQuery, WorkspaceId } from '@overstory/db/schema'

// Human read scope. Derived upstream from the Better Auth session (never client input,
// D34 analog); repoId is non-optional so an unscoped dashboard query is a compile error.
export interface DashCtx {
  db: Db
  workspaceId: WorkspaceId
  repoId: RepoId
}

export type DashWindow = '7d' | '30d' | '90d' | 'all'
export type McpTool = 'context' | 'guard' | 'check' | 'decision' | 'search'
type DecisionStatus = 'proposed' | 'decided' | 'needs_reconfirmation' | 'superseded'

// Debug/curl calls carry no x-overstory-session header and log under this sentinel
// (serving.md). Excluded from the dashboard by default so they don't pollute the signal.
const UNKNOWN_SESSION = 'unknown'

const WINDOW_MS: Record<Exclude<DashWindow, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}
function cutoff(window: DashWindow): Date | null {
  return window === 'all' ? null : new Date(Date.now() - WINDOW_MS[window])
}

// ─── Sessions list ──────────────────────────────────────────────────────────

export interface SessionSummary {
  sessionId: string
  startedAt: Date
  lastAt: Date
  callCount: number
  servedCount: number
  guardCalls: number
  contextCalls: number
  conflictCount: number
  guardFired: boolean // any guard call issued this session
  tools: McpTool[]
}

// One row per agent session (one MCP connection), most-recent first.
export async function listSessions(
  ctx: DashCtx,
  opts: { window?: DashWindow; limit?: number } = {},
): Promise<SessionSummary[]> {
  const { window = 'all', limit = 50 } = opts
  const since = cutoff(window)
  const rows = await ctx.db
    .select({
      sessionId: serveEvents.sessionId,
      startedAt: sql<string>`min(${serveEvents.createdAt})`,
      lastAt: sql<string>`max(${serveEvents.createdAt})`,
      callCount: sql<number>`count(*)::int`,
      servedCount: sql<number>`coalesce(sum(cardinality(${serveEvents.servedDecisionIds})), 0)::int`,
      guardCalls: sql<number>`(count(*) filter (where ${serveEvents.tool} = 'guard'))::int`,
      contextCalls: sql<number>`(count(*) filter (where ${serveEvents.tool} = 'context'))::int`,
      conflictCount: sql<number>`coalesce(sum(cardinality(${serveEvents.conflictDecisionIds})), 0)::int`,
      tools: sql<string>`string_agg(distinct ${serveEvents.tool}::text, ',')`,
    })
    .from(serveEvents)
    .where(
      and(
        eq(serveEvents.repoId, ctx.repoId),
        ne(serveEvents.sessionId, UNKNOWN_SESSION),
        since ? gte(serveEvents.createdAt, since) : undefined,
      ),
    )
    .groupBy(serveEvents.sessionId)
    .orderBy(desc(sql`max(${serveEvents.createdAt})`))
    .limit(limit)

  return rows.map((r) => ({
    sessionId: r.sessionId,
    startedAt: new Date(r.startedAt),
    lastAt: new Date(r.lastAt),
    callCount: r.callCount,
    servedCount: r.servedCount,
    guardCalls: r.guardCalls,
    contextCalls: r.contextCalls,
    conflictCount: r.conflictCount,
    guardFired: r.guardCalls > 0,
    tools: (r.tools ?? '').split(',').filter(Boolean) as McpTool[],
  }))
}

// ─── Session timeline (live payload reconstruction) ─────────────────────────

// A served decision rebuilt from its current row (D28: IDs → render, no snapshot).
// present=false when the decision was deleted since serve time; superseded=true when it
// still exists but has been replaced (D11 supersede-never-delete).
export interface ServedDecisionView {
  id: DecisionId
  present: boolean
  superseded: boolean
  supersededById: DecisionId | null
  title: string | null
  statement: string | null
  why: string | null
  where: { filePath: string; symbol: string | null }[]
  status: DecisionStatus | null
  stale: boolean // status === 'needs_reconfirmation' (D11)
}

export interface TimelineEvent {
  id: ServeEventId
  tool: McpTool
  query: ServeQuery
  createdAt: Date
  latencyMs: number
  served: ServedDecisionView[]
  conflicts: ServedDecisionView[]
}

// Ordered call timeline for one session: exactly what that agent run received.
export async function getSessionTimeline(ctx: DashCtx, sessionId: string): Promise<TimelineEvent[]> {
  const events = await ctx.db
    .select({
      id: serveEvents.id,
      tool: serveEvents.tool,
      query: serveEvents.query,
      createdAt: serveEvents.createdAt,
      latencyMs: serveEvents.latencyMs,
      servedDecisionIds: serveEvents.servedDecisionIds,
      conflictDecisionIds: serveEvents.conflictDecisionIds,
    })
    .from(serveEvents)
    .where(and(eq(serveEvents.repoId, ctx.repoId), eq(serveEvents.sessionId, sessionId)))
    .orderBy(asc(serveEvents.createdAt))

  const ids = [
    ...new Set(events.flatMap((e) => [...e.servedDecisionIds, ...e.conflictDecisionIds])),
  ]
  const byId = await loadDecisionViews(ctx, ids)

  return events.map((e) => ({
    id: e.id,
    tool: e.tool as McpTool,
    query: e.query,
    createdAt: e.createdAt,
    latencyMs: e.latencyMs,
    served: e.servedDecisionIds.map((id) => byId.get(id) ?? missingView(id)),
    conflicts: e.conflictDecisionIds.map((id) => byId.get(id) ?? missingView(id)),
  }))
}

// ─── Activity metrics ───────────────────────────────────────────────────────

export interface ActivityMetrics {
  window: DashWindow
  sessionsTotal: number
  sessionsWithContext: number
  sessionsWithGuard: number
  // Headline (Risk 4). FIRST-SLICE PROXY: fraction of sessions that issued at least one
  // guard call. NOT the true consult-rate, whose denominator is "sessions that edited a
  // decision-bearing file" — unknowable from ServeEvents alone (the MCP server sees only
  // files the agent NAMED, not the full diff). Upward/downward biased; the accurate
  // per-PR version arrives with the GitHub App. The UI MUST render the honesty caption.
  consultRate: number
  alwaysOnInjections: number // count of context calls (one expected per session start)
  guardCalls: number
  guardHits: number // guard calls that returned >=1 decision
  conflicts: number // serve events with a non-empty conflict set (check, D11)
  guardByPath: { filePath: string; count: number }[]
  mostServed: { id: DecisionId; title: string | null; present: boolean; count: number }[]
}

export async function getActivityMetrics(ctx: DashCtx, window: DashWindow = '30d'): Promise<ActivityMetrics> {
  const since = cutoff(window)
  const rows = await ctx.db
    .select({
      tool: serveEvents.tool,
      query: serveEvents.query,
      sessionId: serveEvents.sessionId,
      servedDecisionIds: serveEvents.servedDecisionIds,
      conflictDecisionIds: serveEvents.conflictDecisionIds,
    })
    .from(serveEvents)
    .where(
      and(
        eq(serveEvents.repoId, ctx.repoId),
        ne(serveEvents.sessionId, UNKNOWN_SESSION),
        since ? gte(serveEvents.createdAt, since) : undefined,
      ),
    )

  const sessions = new Set<string>()
  const ctxSessions = new Set<string>()
  const guardSessions = new Set<string>()
  let alwaysOnInjections = 0
  let guardCalls = 0
  let guardHits = 0
  let conflicts = 0
  const pathCounts = new Map<string, number>()
  const servedCounts = new Map<string, number>()

  for (const r of rows) {
    sessions.add(r.sessionId)
    if (r.tool === 'context') {
      ctxSessions.add(r.sessionId)
      alwaysOnInjections++
    }
    if (r.tool === 'guard') {
      guardSessions.add(r.sessionId)
      guardCalls++
      if (r.servedDecisionIds.length > 0) guardHits++
      for (const f of r.query.files ?? []) pathCounts.set(f, (pathCounts.get(f) ?? 0) + 1)
    }
    if (r.conflictDecisionIds.length > 0) conflicts++
    for (const id of r.servedDecisionIds) servedCounts.set(id, (servedCounts.get(id) ?? 0) + 1)
  }

  const topServed = [...servedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const titles = await loadDecisionTitles(ctx, topServed.map(([id]) => id))
  const sessionsTotal = sessions.size

  return {
    window,
    sessionsTotal,
    sessionsWithContext: ctxSessions.size,
    sessionsWithGuard: guardSessions.size,
    consultRate: sessionsTotal ? guardSessions.size / sessionsTotal : 0,
    alwaysOnInjections,
    guardCalls,
    guardHits,
    conflicts,
    guardByPath: [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([filePath, count]) => ({ filePath, count })),
    mostServed: topServed.map(([id, count]) => ({
      id: id as DecisionId,
      title: titles.get(id) ?? null,
      present: titles.has(id),
      count,
    })),
  }
}

// ─── Shared loaders ─────────────────────────────────────────────────────────

// Reconstruct decision views for a set of ids, repo-scoped (tenant boundary). Includes
// superseded rows (timeline shows history); deleted ids simply won't appear in the map.
async function loadDecisionViews(ctx: DashCtx, ids: string[]): Promise<Map<string, ServedDecisionView>> {
  const map = new Map<string, ServedDecisionView>()
  if (ids.length === 0) return map
  const rows = await ctx.db
    .select({
      id: decisions.id,
      title: decisions.title,
      statement: decisions.statement,
      rationale: decisions.rationale,
      status: decisions.status,
      supersededById: decisions.supersededById,
    })
    .from(decisions)
    .where(and(eq(decisions.repoId, ctx.repoId), inArray(decisions.id, ids as DecisionId[])))

  const ptrs = rows.length
    ? await ctx.db
        .select({ decisionId: pointers.decisionId, filePath: pointers.filePath, symbol: pointers.symbol })
        .from(pointers)
        .where(inArray(pointers.decisionId, rows.map((r) => r.id)))
    : []
  const where = new Map<string, { filePath: string; symbol: string | null }[]>()
  for (const p of ptrs) {
    const list = where.get(p.decisionId) ?? []
    list.push({ filePath: p.filePath, symbol: p.symbol })
    where.set(p.decisionId, list)
  }

  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      present: true,
      superseded: r.status === 'superseded',
      supersededById: r.supersededById,
      title: r.title,
      statement: r.statement,
      why: r.rationale.why,
      where: where.get(r.id) ?? [],
      status: r.status,
      stale: r.status === 'needs_reconfirmation',
    })
  }
  return map
}

function missingView(id: string): ServedDecisionView {
  return {
    id: id as DecisionId,
    present: false,
    superseded: false,
    supersededById: null,
    title: null,
    statement: null,
    why: null,
    where: [],
    status: null,
    stale: false,
  }
}

async function loadDecisionTitles(ctx: DashCtx, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  const rows = await ctx.db
    .select({ id: decisions.id, title: decisions.title })
    .from(decisions)
    .where(and(eq(decisions.repoId, ctx.repoId), inArray(decisions.id, ids as DecisionId[])))
  for (const r of rows) map.set(r.id, r.title)
  return map
}
