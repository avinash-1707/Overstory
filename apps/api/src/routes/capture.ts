import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { decisions, flows, pointers } from '@overstory/db/schema'
import type { FlowId } from '@overstory/db/schema'
import { normalizePath } from '@overstory/core/paths'
import { composite } from '@overstory/core/capture'
import { db } from '../lib/db'
import type { AuthVars } from '../middleware/auth'

// POST /v1/capture — the CLI pushes captured decisions here (D24/D26). Repo + workspace
// come from the ApiKey, never the body (tenant boundary). One transaction per run:
// upsert the flow, then append decisions + their code pointers (the path↔decision index).

// alwaysOn (D20) is derived server-side from the composite rank — clients don't set it.
const ALWAYS_ON_THRESHOLD = 0.66

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

// Ranking SIGNALS only — `composite` is recomputed server-side and never trusted from the
// client, because it drives the always-on tier (D20) AND the serving ORDER BY. z.number()
// rejects NaN/Infinity (an Infinity would corrupt the `::float` sort and force always-on);
// each signal is clamped to [0,1] before composite() is applied (audit H3/H6).
const signal = z.number()
const rankingSchema = z.object({
  nonObviousness: signal,
  blastRadius: signal,
  bannedDefaultProximity: signal,
})

// Upper bounds on every field: the body is ApiKey-authed, but its content is LLM-derived, so an
// oversized/flooded payload (unbounded rows, multi-MB strings) is a real write-DoS. Caps are
// generous — they bound the pathological case, not normal capture (audit H4).
const decisionSchema = z.object({
  title: z.string().min(1).max(200),
  statement: z.string().min(1).max(4000),
  rationale: z.object({
    why: z.string().max(4000),
    capturedFrom: z.enum(['reject', 'accept', 'seed_confirmed']),
  }),
  ranking: rankingSchema,
  alternativesConsidered: z.array(z.string().max(2000)).max(20).default([]),
  pointers: z.array(z.string().max(1024)).max(100).default([]),
  topics: z.array(z.string().max(100)).max(50).default([]),
})

const bodySchema = z.object({
  flow: z.object({ name: z.string().min(1).max(200), description: z.string().max(4000).default('') }),
  resolvedSha: z.string().min(1).max(64),
  decisions: z.array(decisionSchema).min(1).max(200),
})

export const capture = new Hono<{ Variables: AuthVars }>()

capture.post('/capture', async (c) => {
  const { repoId } = c.get('auth')
  if (!repoId) return c.json({ error: 'this api key is not bound to a repo' }, 400)

  const raw = await c.req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return c.json({ error: 'invalid body', detail: parsed.error.issues }, 400)
  const body = parsed.data

  const result = await db.transaction(async (tx) => {
    // Serialize concurrent captures of the SAME flow. Without this, the flow
    // upsert and the per-decision check-then-insert below race under READ
    // COMMITTED (two runs both see "no dup", both insert). The xact lock makes
    // the whole per-flow sequence mutually exclusive; it auto-releases on commit
    // and never blocks captures of other flows (distinct key).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${repoId} || ':' || ${body.flow.name}))`)

    // Upsert flow by (repoId, name) — onConflictDoNothing keeps an existing
    // (possibly hand-edited) description; re-select always resolves the id.
    await tx
      .insert(flows)
      .values({ repoId, name: body.flow.name, description: body.flow.description })
      .onConflictDoNothing()
    const flowRows = await tx
      .select({ id: flows.id })
      .from(flows)
      .where(and(eq(flows.repoId, repoId), eq(flows.name, body.flow.name)))
      .limit(1)
    const flowRow = flowRows[0]
    if (!flowRow) throw new Error('flow upsert failed to resolve')
    const flowId: FlowId = flowRow.id

    let persisted = 0
    let skipped = 0
    let pointerless = 0 // persisted but with no resolvable file pointer → never guard-matchable (M5)
    for (const d of body.decisions) {
      // Append-only, skip exact dups on (flowId, statement, capturedFrom). Re-running
      // capture is a no-op for unchanged decisions; never overwrites or deletes (D11).
      // Race-safe because the per-flow advisory lock above serializes same-flow runs.
      const dup = await tx
        .select({ id: decisions.id })
        .from(decisions)
        .where(
          and(
            eq(decisions.flowId, flowId),
            eq(decisions.statement, d.statement),
            sql`${decisions.rationale}->>'capturedFrom' = ${d.rationale.capturedFrom}`,
          ),
        )
        .limit(1)
      if (dup.length > 0) {
        skipped++
        continue
      }

      // Clamp signals to [0,1] and recompute composite server-side; the client's composite (if
      // any) is ignored. This value is the sole input to the always-on tier + serving sort.
      const ranking = {
        nonObviousness: clamp01(d.ranking.nonObviousness),
        blastRadius: clamp01(d.ranking.blastRadius),
        bannedDefaultProximity: clamp01(d.ranking.bannedDefaultProximity),
        composite: 0,
      }
      ranking.composite = composite(ranking)

      const decisionRows = await tx
        .insert(decisions)
        .values({
          repoId,
          flowId,
          title: d.title,
          statement: d.statement,
          status: 'decided',
          rationale: d.rationale,
          alternativesConsidered: d.alternativesConsidered,
          topics: d.topics,
          ranking,
          alwaysOn: ranking.composite >= ALWAYS_ON_THRESHOLD,
          captureMethod: d.rationale.capturedFrom === 'seed_confirmed' ? 'seeded_confirmed' : 'provoked',
        })
        .returning({ id: decisions.id })
      const decisionRow = decisionRows[0]
      if (!decisionRow) throw new Error('decision insert returned no row')
      const decisionId = decisionRow.id

      const seen = new Set<string>()
      const pointerRows: { decisionId: typeof decisionId; kind: 'file'; filePath: string; lastResolvedSha: string }[] = []
      for (const path of d.pointers) {
        const filePath = normalizePath(path)
        if (!filePath || seen.has(filePath)) continue
        seen.add(filePath)
        pointerRows.push({ decisionId, kind: 'file', filePath, lastResolvedSha: body.resolvedSha })
      }
      if (pointerRows.length > 0) {
        await tx.insert(pointers).values(pointerRows).onConflictDoNothing()
      } else {
        // Servable via context/search but never via guard (no file→decision edge). Surface the
        // count so the CLI can warn — e.g. all supplied paths normalized to empty (M5).
        pointerless++
      }
      persisted++
    }
    return { flowId, persisted, skipped, pointerless }
  })

  return c.json(result, 201)
})
