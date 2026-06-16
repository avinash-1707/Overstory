import { z } from 'zod'
import type { Llm } from '../llm'
import type { AnalysisContent, CandidateDecision } from '../analysis/schema'

export const provocationSchema = z.object({
  alternative: z.string().describe('"you could do X instead" — framed to provoke a defense, not to be correct (D5)'),
  tradeoffs: z.string().describe('the honest tradeoffs of the alternative vs the current design'),
  plausible: z
    .boolean()
    .describe('self-check (D16): is this plausible — a smart senior could suggest it — and not dumb / a strawman / a restatement of the status quo?'),
  plausibilityNote: z.string().describe('one line justifying the plausibility verdict'),
})
export type Provocation = z.infer<typeof provocationSchema>

const SYSTEM = `You generate a single provocation for a recorded design decision.

A provocation presents a credible alternative approach and its tradeoffs, inviting the
developer to defend their choice. The goal is to *elicit a defense*, not to be right — a
wrong-but-plausible provocation that triggers "no, because X" succeeds, because X is the
rationale we want to capture.

Hard rule: the alternative must be plausible — something a thoughtful senior engineer could
genuinely propose given this flow. It must never be dumb, a strawman, or a restatement of
what the code already does. Run that self-check honestly and report it.`

export async function provoke(
  llm: Llm,
  candidate: CandidateDecision,
  analysis: AnalysisContent,
): Promise<Provocation> {
  const prompt = `Flow summary: ${analysis.summary}

Observed invariants:
${analysis.observedInvariants.map((i) => `- ${i}`).join('\n') || '- (none recorded)'}

Recorded decision:
${candidate.statement}

Why it appears intentional:
${candidate.whyItMightBeIntentional}

A candidate alternative the engine surfaced (refine or replace it):
${candidate.plausibleAlternative}

Produce the provocation. Do not contradict the observed invariants, and do not restate the
current design as if it were the alternative.`

  return llm.extract(prompt, provocationSchema, 'provocation', {
    tier: 'reasoning',
    system: SYSTEM,
  })
}
