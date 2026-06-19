// Contradiction check (D11) — the agent-side CATCH layer (D17). Given a proposed change
// (files + a short summary), find the recorded decisions governing those files and judge,
// via one LLM call, which the change CONTRADICTS. WARN-ONLY: it returns conflicts and logs
// conflictDecisionIds (the dashboard's agent-side catch signal, D28); it does NOT flip
// decision status. The change isn't real yet — a pre-finalize advisory call must not create
// false freshness. The status flip + ContradictionEvent (D11 resolution) belong to the
// PR-time backstop (D27), where the change is actually committed. See docs/technical/serving.md.
import { z } from 'zod'
import type { DecisionId } from '@overstory/db/schema'
import { Llm } from '../llm'
import {
  type ServeCtx,
  type ServedDecision,
  findDecisionsByFiles,
  logServe,
  normalizeFiles,
} from '../serving'

export interface CheckInput {
  files: string[]
  summary: string
}

// What the agent receives — which decisions its change conflicts with, and why.
export interface Conflict {
  decisionId: DecisionId
  title: string
  detail: string // one sentence naming the specific conflict
}

// The LLM verdict. decisionId is validated back against the candidate set (hallucination
// guard) before anything is surfaced — the model only ever sees ids we gave it.
const verdictSchema = z.object({
  conflicts: z.array(
    z.object({
      decisionId: z.string(),
      detail: z.string(),
    }),
  ),
})

// Precision-first (D11): false positives erode trust faster than false negatives annoy.
// One call judges the whole candidate set at once — gives the model cross-decision context.
// Sonnet-class triage with NO thinking tokens and a small budget (D25 — triage must be
// cheap; the verdict is tiny JSON, ~80 completion tokens). The default reasoning budget
// (12k) is both wasteful here and large enough to 402 a low-balance metered account.
// (PR-time fan-out, D27, may want the cheap-triage-then-Opus-confirm split; deferred.)
const CHECK_OPTS = { tier: 'reasoning', reasoning: false, maxTokens: 2000 } as const
// Bound each field fed to the judge: candidate COUNT is capped (FILE_MATCH_LIMIT) but content
// length is not, so a handful of very long statements could bloat the metered prompt. New
// captures are length-bounded at ingest, but pre-existing/seeded rows may be longer (audit M4).
const clip = (s: string, n = 1000): string => (s.length > n ? `${s.slice(0, n)}…` : s)

function buildPrompt(summary: string, candidates: ServedDecision[]): string {
  const list = candidates
    .map((c) => `- id: ${c.id}\n  decision: ${clip(c.statement)}\n  rationale: ${clip(c.why)}`)
    .join('\n')
  return [
    'A coding agent is about to make this change:',
    '<change>',
    summary,
    '</change>',
    '',
    "These recorded architectural decisions govern the files the agent is touching:",
    list,
    '',
    'For each decision, judge whether the proposed change CONTRADICTS it — i.e. does the',
    'opposite of, reverses, or violates what was decided. Be conservative: a change that is',
    'unrelated to, consistent with, or merely adjacent to a decision is NOT a contradiction.',
    'Only flag a clear, direct conflict; false alarms erode trust. Return ONLY the decisions',
    'that are genuinely contradicted, each with a one-sentence detail naming the specific',
    'conflict. Return an empty list if nothing conflicts.',
  ].join('\n')
}

export async function checkContradictions(
  ctx: ServeCtx,
  llm: Llm,
  input: CheckInput,
): Promise<Conflict[]> {
  const start = Date.now()
  const normalized = normalizeFiles(input.files)
  const candidates = await findDecisionsByFiles(ctx, normalized)

  if (candidates.length === 0) {
    logServe(ctx, 'check', { files: normalized, summary: input.summary }, [], start)
    return []
  }

  const byId = new Map<DecisionId, ServedDecision>(candidates.map((c) => [c.id, c]))
  let conflicts: Conflict[] = []
  try {
    const verdict = await llm.extract(
      buildPrompt(input.summary, candidates),
      verdictSchema,
      'contradiction_check',
      CHECK_OPTS,
    )
    // Keep only verdicts that name a real candidate id (the model can't invent decisions).
    conflicts = verdict.conflicts.flatMap((v) => {
      const c = byId.get(v.decisionId as DecisionId)
      return c ? [{ decisionId: c.id, title: c.title, detail: v.detail }] : []
    })
  } catch {
    // Degrade open (D32 ethos): record the call (so the Risk-signal isn't undercounted) but
    // surface no conflicts rather than block the agent on an LLM failure.
    conflicts = []
  }

  const conflictDecisions = conflicts.map((c) => byId.get(c.decisionId)).filter((c): c is ServedDecision => Boolean(c))
  logServe(ctx, 'check', { files: normalized, summary: input.summary }, candidates, start, conflictDecisions)
  return conflicts
}
