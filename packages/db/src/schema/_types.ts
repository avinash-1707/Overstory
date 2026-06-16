// Shapes for jsonb columns (data-model.md). Stored as JSONB; typed via `.$type<>()`.
import type { DecisionId } from './_ids'

export interface Rationale {
  why: string // the reasoning, in the dev's words
  capturedFrom: 'reject' | 'accept' | 'seed_confirmed' // how it entered (D4)
}

export interface DecisionRanking {
  nonObviousness: number // 0–1: would an agent get this wrong by default?
  blastRadius: number // 0–1: how cross-cutting / high-impact
  bannedDefaultProximity: number // 0–1: is there a tempting wrong default nearby?
  composite: number // weighted combination; sort key + alwaysOn threshold (D19)
}

export interface Provenance {
  commitShas: string[]
  prUrls: string[]
  ticketUrls: string[]
  note: string | null // inferable-vs-head-only delta the human added (D18)
}

// AnalysisArtifact.content — engine layer, never served (D16).
export interface AnalysisContent {
  summary: string
  components: { name: string; role: string; pointers: string[] }[]
  dataFlow: string
  observedInvariants: string[]
  candidateDecisions: CandidateDecision[]
}

export interface CandidateDecision {
  statement: string
  whyItMightBeIntentional: string
  plausibleAlternative: string // seed for a provocation (D16)
  estimatedRanking: DecisionRanking
}

// ServeEvent.query — only the field(s) for the called tool are set (D28).
export interface ServeQuery {
  files?: string[] // guard / check
  summary?: string // check
  decisionId?: DecisionId // decision
  query?: string // search
}
