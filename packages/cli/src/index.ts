#!/usr/bin/env node
// @overstory/cli — local trigger + the dogfood capture answer client.
// Risk-first slice: run the capture loop on one cold flow and answer provocations.
//
//   overstory capture <path>   — analyze -> rank -> provoke, then defend (accept/reject)
//   overstory analyze <path>   — deep-analyze a flow, print ranked candidate decisions
import { execFile } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { Command } from 'commander'
import * as p from '@clack/prompts'
import { env } from '@overstory/config'
import { Llm, type TokenUsage } from '@overstory/core/llm'
import { analyzeFlow } from '@overstory/core/analysis'
import { provoke, rankCandidates, selectVitalFew } from '@overstory/core/capture'
import { readFlowFiles } from './files'

const execFileAsync = promisify(execFile)

interface Ranking {
  nonObviousness: number
  blastRadius: number
  bannedDefaultProximity: number
  composite: number
}

interface CapturedDecision {
  title: string
  statement: string
  pointers: string[]
  ranking: Ranking
  outcome: 'reject_with_reason' | 'accept'
  rationale: string
  alternative: string
}

interface PersistResult {
  flowId: string
  persisted: number
  skipped: number
  pointerless: number
}

// Scrub known secrets from any user-facing error text — a reflected backend/LLM response body
// could otherwise echo the bearer key into the terminal + scrollback (audit M1).
function redact(s: string): string {
  let out = s
  for (const secret of [env.OVERSTORY_API_KEY, env.OPENROUTER_API_KEY]) {
    if (secret) out = out.split(secret).join('[redacted]')
  }
  return out
}

function titleFrom(statement: string): string {
  const firstLine = statement.split('\n')[0]?.trim() || statement
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine
}

async function gitHeadSha(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd })
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function persist(apiUrl: string, apiKey: string, body: unknown): Promise<PersistResult> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/capture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`persist failed (${res.status}): ${detail}`)
  }
  return (await res.json()) as PersistResult
}

function makeLlm(): Llm {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    p.cancel('OPENROUTER_API_KEY is not set.')
    process.exit(1)
  }
  return new Llm({
    apiKey,
    referer: 'https://overstory.dev',
    title: 'Overstory',
    models: {
      reasoning: env.OVERSTORY_MODEL_REASONING,
      fast: env.OVERSTORY_MODEL_FAST,
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

    // Upper bound (L5 audit): each provocation is an LLM round-trip, so an absurd --budget
    // would burn credits/time with no benefit (the effective cap is candidate count anyway).
    const MAX_BUDGET = 20
    const budget = Number(opts.budget)
    if (!Number.isInteger(budget) || budget < 1 || budget > MAX_BUDGET) {
      p.cancel(`--budget must be an integer between 1 and ${MAX_BUDGET}`)
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
        title: titleFrom(candidate.statement),
        statement: candidate.statement,
        pointers: candidate.pointers,
        ranking: { ...candidate.estimatedRanking, composite },
        outcome: outcome === 'reject' ? 'reject_with_reason' : 'accept',
        rationale,
        alternative: prov.alternative,
      })
    }

    const tok = `${totals.prompt + totals.completion} tok ($${totals.cost.toFixed(4)})`
    if (captured.length === 0) {
      p.outro(`Captured 0 decisions · ${fmtSecs(started)} · ${tok}`)
      return
    }

    const apiUrl = env.OVERSTORY_API_URL
    const apiKey = env.OVERSTORY_API_KEY

    if (apiUrl && apiKey) {
      const abs = resolve(path)
      const cwd = (await stat(abs)).isFile() ? dirname(abs) : abs
      const sha = await gitHeadSha(cwd)
      if (!sha) {
        p.cancel('Capture must run inside a git checkout — could not resolve HEAD for pointer SHAs.')
        process.exit(1)
      }
      const body = {
        flow: { name: opts.name ?? path, description: analysis.summary },
        resolvedSha: sha,
        decisions: captured.map((d) => ({
          title: d.title,
          statement: d.statement,
          rationale: { why: d.rationale, capturedFrom: d.outcome === 'reject_with_reason' ? 'reject' : 'accept' },
          ranking: d.ranking,
          alternativesConsidered: [d.alternative],
          pointers: d.pointers,
        })),
      }
      try {
        const r = await spin(
          'Persisting to Overstory',
          () => persist(apiUrl, apiKey, body),
          (r) => `persisted ${r.persisted}, skipped ${r.skipped} dup(s)`,
        )
        if (r.pointerless > 0) {
          p.log.warn(`${r.pointerless} decision(s) stored without a resolvable file pointer — guard won't surface them.`)
        }
        p.outro(`Captured ${captured.length} · persisted ${r.persisted} (skipped ${r.skipped}) · ${fmtSecs(started)} · ${tok}`)
      } catch (err) {
        // Don't lose the human's answered provocations to a transient persist failure — dump
        // them so the run can be retried or POSTed manually (audit M6). Guard the write itself:
        // if even the dump fails (read-only cwd, disk full), fall back to stdout so the answers
        // always reach the user.
        p.log.error(`Persist failed: ${redact(err instanceof Error ? err.message : String(err))}`)
        const dump = resolve(`overstory-capture-${sha}.json`)
        try {
          await writeFile(dump, `${JSON.stringify(body, null, 2)}\n`)
          p.outro(`Saved ${captured.length} captured decision(s) to ${dump} — re-run capture or POST manually.`)
        } catch {
          process.stdout.write(`${JSON.stringify(body, null, 2)}\n`)
          p.outro(`Could not write dump file — printed ${captured.length} decision(s) above; copy them to re-POST.`)
        }
      }
    } else {
      p.log.warn('OVERSTORY_API_URL / OVERSTORY_API_KEY not set — printing JSON instead of persisting.')
      process.stdout.write(`${JSON.stringify(captured, null, 2)}\n`)
      p.outro(`Captured ${captured.length} decision(s) · ${fmtSecs(started)} · ${tok}`)
    }
  })

program.parseAsync().catch((err: unknown) => {
  p.log.error(redact(err instanceof Error ? err.message : String(err)))
  process.exit(1)
})
