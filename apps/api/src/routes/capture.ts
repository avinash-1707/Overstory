import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { decisions, flows, pointers } from '@overstory/db/schema'
import type { FlowId } from '@overstory/db/schema'
import { db } from '../lib/db'
import type { AuthVars } from '../middleware/auth'

// POST /v1/capture — the CLI pushes captured decisions here (D24/D26). Repo + workspace
// come from the ApiKey, never the body (tenant boundary). One transaction per run:
// upsert the flow, then append decisions + their code pointers (the path↔decision index).

// alwaysOn (D20) is derived server-side from the composite rank — clients don't set it.
const ALWAYS_ON_THRESHOLD = 0.66

const rankingSchema = z.object({
  nonObviousness: z.number(),
  blastRadius: z.number(),
  bannedDefaultProximity: z.number(),
  composite: z.number(),
})

const decisionSchema = z.object({
  title: z.string().min(1),
  statement: z.string().min(1),
  rationale: z.object({
    why: z.string(),
    capturedFrom: z.enum(['reject', 'accept', 'seed_confirmed']),
  }),
  ranking: rankingSchema,
  alternativesConsidered: z.array(z.string()).default([]),
  pointers: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
})

const bodySchema = z.object({
  flow: z.object({ name: z.string().min(1), description: z.string().default('') }),
  resolvedSha: z.string().min(1),
  decisions: z.array(decisionSchema).min(1),
})

// Canonical repo-relative path: posix separators, no `./` prefix, no trailing slash.
// Guard's exact + directory-prefix match (serving) depends on one canonical form.
function normalizePath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}

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
          ranking: d.ranking,
          alwaysOn: d.ranking.composite >= ALWAYS_ON_THRESHOLD,
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
      }
      persisted++
    }
    return { flowId, persisted, skipped }
  })

  return c.json(result, 201)
})
