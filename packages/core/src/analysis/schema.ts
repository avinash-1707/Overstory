import { z } from 'zod'

// Ranking signals the engine estimates per candidate (D19). Each is 0..1.
export const decisionRankingSchema = z.object({
  nonObviousness: z.number().describe('0..1 — would a coding agent get this wrong by default?'),
  blastRadius: z.number().describe('0..1 — how cross-cutting / high-impact the decision is'),
  bannedDefaultProximity: z
    .number()
    .describe('0..1 — is there a tempting wrong default an agent would reach for?'),
})
export type DecisionRanking = z.infer<typeof decisionRankingSchema>

// Raw material the capture loop ranks and provokes on (D16).
export const candidateDecisionSchema = z.object({
  statement: z.string().describe('what was decided, stated precisely'),
  whyItMightBeIntentional: z.string().describe('the engine\'s read on why this was chosen'),
  plausibleAlternative: z
    .string()
    .describe('a smart-senior alternative — the seed for a provocation (plausible, not dumb)'),
  pointers: z.array(z.string()).describe('repo-relative file paths this decision governs'),
  estimatedRanking: decisionRankingSchema,
})
export type CandidateDecision = z.infer<typeof candidateDecisionSchema>

// The engine's genuine understanding of one flow — never served to agents (D16).
export const analysisContentSchema = z.object({
  summary: z.string().describe('what this flow is and does'),
  components: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      pointers: z.array(z.string()),
    }),
  ),
  dataFlow: z.string().describe('how data moves through the flow'),
  observedInvariants: z.array(z.string()).describe('cross-cutting rules the engine noticed'),
  candidateDecisions: z.array(candidateDecisionSchema),
})
export type AnalysisContent = z.infer<typeof analysisContentSchema>
