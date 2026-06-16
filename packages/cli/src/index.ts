#!/usr/bin/env node
// @overstory/cli — local trigger + the dogfood capture answer client.
// Risk-first slice: run the capture loop on one cold flow and answer provocations.
//
//   overstory capture <path>   — analyze -> rank -> provoke, then defend (accept/reject)
//   overstory analyze <path>   — deep-analyze a flow, print ranked candidate decisions
import { Command } from 'commander'
import * as p from '@clack/prompts'
import { Llm, type TokenUsage } from '@overstory/core/llm'
import { analyzeFlow } from '@overstory/core/analysis'
import { provoke, rankCandidates, selectVitalFew } from '@overstory/core/capture'
import { readFlowFiles } from './files'

// Load env from cwd or the repo root before reading any keys.
for (const envPath of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(envPath)
  } catch {
    // no .env at this path — rely on the ambient environment
  }
}

interface CapturedDecision {
  statement: string
  pointers: string[]
  composite: number
  outcome: 'reject_with_reason' | 'accept'
  rationale: string
  alternative: string
}

function makeLlm(): Llm {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    p.cancel('OPENROUTER_API_KEY is not set.')
    process.exit(1)
  }
  return new Llm({
    apiKey,
    referer: 'https://overstory.dev',
    title: 'Overstory',
    models: {
      reasoning: process.env.OVERSTORY_MODEL_REASONING,
      fast: process.env.OVERSTORY_MODEL_FAST,
    },
    onUsage: logUsage,
  })
}

const totals = { prompt: 0, completion: 0, cost: 0 }

function fmtSecs(start: number): string {
  return `${Math.round((Date.now() - start) / 1000)}s`
}

// Spinner with a live elapsed-time readout (the LLM call is non-streaming, so
// this is the only mid-call signal — token counts arrive on completion).
async function spin<T>(label: string, fn: () => Promise<T>, done?: (r: T) => string): Promise<T> {
  const s = p.spinner()
  const start = Date.now()
  s.start(label)
  const tick = setInterval(() => s.message(`${label} (${fmtSecs(start)})`), 1000)
  try {
    const result = await fn()
    clearInterval(tick)
    s.stop(`${done ? done(result) : label} (${fmtSecs(start)})`)
    return result
  } catch (err) {
    clearInterval(tick)
    s.stop(`${label} — failed (${fmtSecs(start)})`)
    throw err
  }
}

function logUsage(model: string, u: TokenUsage): void {
  totals.prompt += u.promptTokens
  totals.completion += u.completionTokens
  totals.cost += u.costUsd ?? 0
  const cost = u.costUsd != null ? ` ($${u.costUsd.toFixed(4)})` : ''
  const running = `${totals.prompt + totals.completion} tok ($${totals.cost.toFixed(4)})`
  p.log.message(`${model} — ${u.promptTokens}+${u.completionTokens} tok${cost} · total ${running}`)
}

function bail(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }
}

const program = new Command()
program.name('overstory').description('Overstory capture client').version('0.0.0')

program
  .command('analyze')
  .argument('<path>', 'file or directory that defines the flow')
  .option('-n, --name <name>', 'flow name')
  .description('Deep-analyze a flow and print ranked candidate decisions')
  .action(async (path: string, opts: { name?: string }) => {
    p.intro('Overstory analyze')
    const llm = makeLlm()
    const files = await readFlowFiles(path)
    if (files.length === 0) {
      p.cancel('No source files found at that path.')
      process.exit(1)
    }

    const started = Date.now()
    const analysis = await spin(
      `Analyzing ${files.length} file(s)`,
      () => analyzeFlow(llm, { name: opts.name ?? path, files }),
      (a) => `${a.candidateDecisions.length} candidate decision(s)`,
    )

    p.note(analysis.summary, 'Summary')
    for (const { candidate, composite } of rankCandidates(analysis.candidateDecisions)) {
      p.log.step(`[${composite.toFixed(2)}] ${candidate.statement}`)
    }
    p.outro(`Done in ${fmtSecs(started)} · ${totals.prompt + totals.completion} tok ($${totals.cost.toFixed(4)})`)
  })

program
  .command('capture')
  .argument('<path>', 'file or directory that defines the flow')
  .option('-n, --name <name>', 'flow name')
  .option('-b, --budget <n>', 'max provocations this session', '3')
  .description('Run the capture loop on a flow and answer provocations')
  .action(async (path: string, opts: { name?: string; budget: string }) => {
    p.intro('Overstory capture')
    const llm = makeLlm()
    const files = await readFlowFiles(path)
    if (files.length === 0) {
      p.cancel('No source files found at that path.')
      process.exit(1)
    }

    const started = Date.now()
    const analysis = await spin(
      `Analyzing ${files.length} file(s)`,
      () => analyzeFlow(llm, { name: opts.name ?? path, files }),
      (a) => `${a.candidateDecisions.length} candidate decision(s)`,
    )

    const budget = Number(opts.budget)
    if (!Number.isInteger(budget) || budget < 1) {
      p.cancel('--budget must be a positive integer')
      process.exit(1)
    }

    const vital = selectVitalFew(rankCandidates(analysis.candidateDecisions), budget)
    const captured: CapturedDecision[] = []

    for (const { candidate, composite } of vital) {
      const prov = await spin('Generating provocation', () => provoke(llm, candidate, analysis))

      if (!prov.plausible) {
        p.log.warn(`Skipped (failed plausibility self-check): ${candidate.statement}`)
        continue
      }

      p.note(`${prov.alternative}\n\nTradeoffs: ${prov.tradeoffs}`, candidate.statement)

      const outcome = await p.select({
        message: 'Your call?',
        options: [
          { value: 'reject', label: 'Reject with reason — keep the current design (locks the decision)' },
          { value: 'accept', label: 'Accept — I want this change' },
          { value: 'skip', label: 'Skip' },
        ],
      })
      bail(outcome)
      if (outcome === 'skip') continue

      const rationale = await p.text({
        message:
          outcome === 'reject'
            ? 'Why keep it? (this becomes the recorded rationale)'
            : 'What direction do you want instead?',
        placeholder: 'In your own words…',
      })
      bail(rationale)

      captured.push({
        statement: candidate.statement,
        pointers: candidate.pointers,
        composite,
        outcome: outcome === 'reject' ? 'reject_with_reason' : 'accept',
        rationale,
        alternative: prov.alternative,
      })
    }

    p.outro(`Captured ${captured.length} decision(s) · ${fmtSecs(started)} · ${totals.prompt + totals.completion} tok ($${totals.cost.toFixed(4)})`)
    if (captured.length > 0) process.stdout.write(`${JSON.stringify(captured, null, 2)}\n`)
  })

program.parseAsync().catch((err: unknown) => {
  p.log.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
