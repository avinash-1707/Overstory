import type { CandidateDecision, DecisionRanking } from '../analysis/schema'

// D19 starting weights — tuned during dogfood. Targets the cases where an agent
// re-makes a banned choice: tempting wrong default × high blast radius × non-obvious.
const WEIGHTS = {
  bannedDefaultProximity: 0.4,
  blastRadius: 0.35,
  nonObviousness: 0.25,
} as const

export function composite(r: DecisionRanking): number {
  return (
    WEIGHTS.bannedDefaultProximity * r.bannedDefaultProximity +
    WEIGHTS.blastRadius * r.blastRadius +
    WEIGHTS.nonObviousness * r.nonObviousness
  )
}

export interface RankedCandidate {
  candidate: CandidateDecision
  composite: number
}

export function rankCandidates(candidates: CandidateDecision[]): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, composite: composite(candidate.estimatedRanking) }))
    .sort((a, b) => b.composite - a.composite)
}

/** Take the vital few by composite score (D19) — defer the long tail. */
export function selectVitalFew(ranked: RankedCandidate[], budget: number): RankedCandidate[] {
  return ranked.slice(0, Math.max(0, budget))
}
