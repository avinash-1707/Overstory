// Analysis — deep flow understanding (engine layer, D16). Builds the
// AnalysisContent that makes provocations credible; never served to agents.
// Pointer resolution via ts-morph (D15) is deferred.
import type { Llm } from '../llm'
import { analysisContentSchema, type AnalysisContent } from './schema'

export * from './schema'

export interface FlowFile {
  path: string
  content: string
}

export interface FlowInput {
  name: string
  description?: string
  files: FlowFile[]
}

const SYSTEM = `You are Overstory's flow-analysis engine. You read a slice of a codebase and
recover the *intentional design* it embodies — the decisions, boundaries, and cross-cutting
invariants the code never states.

Your job is not to grade the code or find bugs. It is to surface candidate architectural
decisions: choices a developer made deliberately, where a coding agent left to its own
devices might reach for a different (and wrong) default. For each candidate, name a
plausible alternative a thoughtful senior engineer could genuinely propose — never a strawman.

Be precise and grounded in the code you were given. Do not invent components or files that
are not present.`

export async function analyzeFlow(llm: Llm, flow: FlowInput): Promise<AnalysisContent> {
  return llm.extract(buildPrompt(flow), analysisContentSchema, 'analysis', {
    tier: 'reasoning',
    effort: 'high',
    system: SYSTEM,
  })
}

function buildPrompt(flow: FlowInput): string {
  const header = flow.description
    ? `Flow: ${flow.name}\n${flow.description}`
    : `Flow: ${flow.name}`
  const files = flow.files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n')
  return `${header}

Analyze this flow and produce its structured understanding. Focus the candidate decisions on
the non-obvious, cross-cutting choices where an agent would plausibly re-make a banned default.

Source files:

${files}`
}
