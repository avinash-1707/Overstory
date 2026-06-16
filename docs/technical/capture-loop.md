# Overstory — Capture Loop

> **Status:** Build-phase technical doc. Defines how rationale gets _into_ Overstory — the centerpiece (D4) and the one defensible thing (D18). Reads/writes the entities in `data-model.md`; the serving side is `serving.md`.
>
> **Stack:** TypeScript (D21). Cloud capture worker with GitHub App read access (D27), managed metered LLM (D25). CLI = optional local trigger / answer client.

---

## Scope of this doc

**Covers:** flow discovery → deep analysis (D16) → seeding (D18) → ranking & budgeting (D19) → provocation (D5/D16) → defend (D4) → persist; plus incremental passes (D8) and contradiction detection (D11), and the LLM/cost model.

**Defers:** entity shapes → `data-model.md`. The MCP tool surface and two-tier serving → `serving.md`.

**The existential metric.** Provocation quality is the moat (D18) and the thing dogfooding must validate honestly (Risk 3). Every stage below is in service of one output: a _credible_ provocation that elicits clean head-only rationale. If that output is weak, nothing else matters.

---

## The loop in one picture

```
  discover flows
        │
        ▼
  deep analysis (D16) ──▶ AnalysisArtifact (append-only, engine layer)
        │                      │ candidate decisions
        ▼                      ▼
  seed from git/PR/tickets (D18) ──▶ draft rationale + "head-only delta"
        │
        ▼
  rank & budget (D19) ──▶ the vital few  (+ set alwaysOn, D20)
        │
        ▼
  provoke (D5/D16) ──▶ Provocation(pending)  ──┐  generated server-side, queued
                                               │
                          dev answers later via CLI/web (async)
                                               │
        ┌──────────────────────────────────────┘
        ▼
  defend (D4): accept │ reject-with-reason
        │
        ▼
  persist: Decision + Rationale + Pointers  (status: decided)
```

**Key shape: the loop is asynchronous.** The cloud worker does analysis → ranking → provocation and queues `Provocation(pending)`. The human answers later through a client (CLI TUI for dogfood, web later) that pulls pending provocations and pushes back accept/reject. Analysis is server-side (D27); the human-in-the-loop is client-side and time-shifted.

---

## Where it runs & what triggers it

| Trigger | Source | Scope of work |
| --- | --- | --- |
| **Onboarding** | user connects a repo | discover flows; deep-analyze + provoke the **vital few** across the repo (D19) |
| **Incremental** | GitHub webhook on merged PR / new flow detected | analyze only the changed/new area (D8) |
| **Contradiction** | PR webhook, or MCP guard-query miss at agent-edit time | check the change against stored decisions; re-provoke on conflict (D11) |

All three run in the **cloud capture worker**, reading the repo via the GitHub App (D27, read-only) and calling Claude through the managed metered proxy (D25). The CLI can trigger an onboarding/incremental run locally and is the dogfood answer client, but is not the execution site.

---

## Stage 1 — Flow discovery

Segment the repo into **flows** (D12 — the unit a subagent reasons about, and the human scope for a decision, D22).

- **Heuristics:** entrypoints (routes, handlers, jobs, CLI commands), module boundaries, directory structure, import clustering.
- **Output:** `Flow` records (proposed), each with a name + description.
- **Human confirm (light):** the dev confirms/renames/merges the proposed flow list before deep analysis spends tokens. Cheap gate; avoids analyzing a bad segmentation.

```ts
interface FlowProposal {
  name: string
  description: string
  entrypoints: string[]      // file paths that anchor the flow
  rationale: string          // why the worker thinks this is one coherent flow
}
// worker → human confirm → Flow[] persisted
```

Per-flow scoping keeps inference accurate at capture time (D12) and bounds per-run cost.

---

## Stage 2 — Deep analysis (D16)

A per-flow subagent builds the `AnalysisArtifact` — the engine's genuine understanding, **never served** to agents (D16).

- **Input:** the flow's files (read live via GitHub App), plus seeds from Stage 3.
- **Output:** `AnalysisContent` — components, data flow, observed invariants, and **candidate decisions** (the raw material for provocation).
- **Plausibility, not correctness (D16).** The bar is "a smart senior could plausibly suggest this alternative," not Greptile-grade proof. The analysis must be deep enough to make a credible provocation — no deeper.
- **Append-only (D7/D8).** Incremental runs refine the artifact (new version), never re-derive wholesale.

```ts
// LLM call contract (Opus-class — quality matters here, D16)
async function analyzeFlow(flow: Flow, files: FileContents[], seeds: Seed[]): Promise<AnalysisContent>
// returns: { summary, components[], dataFlow, observedInvariants[], candidateDecisions[] }
```

Each `candidateDecision` carries a `plausibleAlternative` (seed for the provocation) and an `estimatedRanking`.

---

## Stage 3 — Seeding (D18)

Turn retrievable "why" into a head start, so the human is asked only for the **head-only delta**.

- **Read** (server-side, via GitHub App + connectors): commit messages, PR titles/descriptions/threads, linked tickets (Linear/Jira later).
- **Extract** (cheap model): for each candidate decision, pull any rationale already stated in those sources → draft `Rationale`.
- **Split:** mark what was _inferable from sources_ vs the _head-only delta_ still missing. Record sources as `Provenance`.

```ts
interface Seed {
  candidateRef: string
  inferableRationale: string | null   // pre-filled draft from sources
  provenance: Provenance              // commitShas / prUrls / ticketUrls
  headOnlyGaps: string[]              // what the sources do NOT explain — the delta to ask
}
```

This inverts the shrinking-un-retrievable-set risk (D18): the more "why" exists in retrievable form, the smaller the human's burden, and the better the provocation.

---

## Stage 4 — Ranking & budgeting (D19)

Don't provoke on everything — onboarding fatigue kills the loop (D19). Score, sort, take the vital few.

```ts
interface DecisionRanking {
  nonObviousness: number          // 0–1: would an agent get this wrong by default?
  blastRadius: number             // 0–1: how cross-cutting / high-impact
  bannedDefaultProximity: number  // 0–1: is there a tempting wrong default nearby?
  composite: number               // weighted sum; the sort key
}

// starting weights (tune during dogfood — see open questions)
composite = 0.4*bannedDefaultProximity + 0.35*blastRadius + 0.25*nonObviousness
```

- **Vital few:** take candidates by `composite` until a per-session **budget** is hit (e.g. N provocations). Defer the tail to incremental + contradiction-triggered capture.
- **Always-on tier (D20):** candidates whose `composite` clears a high threshold get `alwaysOn = true` — the top slice that's injected regardless of task at serve time.
- **Why these signals:** they target exactly the "agent re-makes a banned choice" cases — high blast radius + a tempting wrong default + non-obvious. The conventional choices an agent gets right anyway are skipped.

---

## Stage 5 — Provocation (D5/D16)

Generate the alternative that earns a defense.

- **Form:** "Here's what you have; here's a different approach and its tradeoffs. Why this way?"
- **Goal:** elicit a defense, **not** be correct (D5). A _wrong_ provocation that triggers "no, because X" succeeds — X is the rationale.
- **Quality guardrail (the band, D16):** it must be _plausible_ (a smart senior could suggest it), never _dumb_ (ignores obvious context). A dumb provocation early poisons the relationship. Guardrail: a self-check pass rejects provocations that contradict the analysis's own `observedInvariants` or restate the status quo.

```ts
// Opus-class — this is the quality-critical call
async function provoke(candidate: CandidateDecision, analysis: AnalysisContent): Promise<{
  alternative: string
  tradeoffs: string
}>
// → persisted as Provocation(outcome: 'pending'), queued for the human
```

---

## Stage 6 — Defend: accept / reject-with-reason (D4)

The human answers (async, via CLI/web client).

- **Reject-with-reason** → keep the current design; capture the defense as `Rationale`; create/lock a `Decision` (status `decided`). The rejection _is_ the confirmation.
- **Accept** → the dev wants the change; record the new/intended direction (also a decision — D10, decided/not-decided, never good/bad).
- **Outcome persisted:** `Provocation.outcome` + `producedRationale`; a `Decision` with pointers (resolved via ts-morph) and `provenance`.

UX notes (Experiment B): the answer flow must feel engaging to a _tired_ dev. One provocation at a time, pre-filled seed shown, "reject-with-reason" as the cheap default path. **Dogfood honesty (Risk 3):** run the loop on a _cold_ flow (one the founder barely remembers) — answering from reconstruction, not recitation — or the test is a false green.

---

## Incremental pass (D8)

- **Triggers:** a merged PR touching an un-analyzed area, or a newly detected flow.
- **Work:** analyze only the delta; refine the affected `AnalysisArtifact` (new version); rank + provoke only new candidates above budget threshold.
- **No full re-review** — rationale is stable (D6/D7); we grow the memory, we don't rebuild it.

---

## Contradiction detection (D11)

The freshness mechanism. Two entry points:

1. **Agent-edit time** — the MCP guard query returns decisions on the touched files; if the agent's proposed change conflicts with a decision's `statement`, flag it (`serving.md` owns the guard call; this doc owns the conflict judgment).
2. **PR time** — GitHub App webhook: for each changed file, look up decisions via the path→decision index; compare the diff against each decision's `statement` + `rationale`.

```ts
// cheap-model triage → Opus-class confirm only on suspected conflicts
async function detectContradiction(diff: FileDiff, decision: Decision): Promise<{
  contradicts: boolean
  detail: string
}>
```

On a confirmed conflict: create `ContradictionEvent`, set `Decision.status = 'needs_reconfirmation'`, and re-provoke — _"this change goes against a recorded decision — still true?"_ Resolution is either reconfirm (`still_true`, bump `lastConfirmedAt`) or supersede (new decision, old → `superseded`).

**Precision matters:** false positives (bogus "you're contradicting X") annoy and erode trust; false negatives let decisions rot silently (the standing Risk 1). Triage cheap, confirm expensive.

---

## LLM usage & cost (D25, subagent-run-cost)

Managed metered proxy (D25) — Overstory pays, so per-flow cost must stay under what a user will pay.

| Step | Model class | Why |
| --- | --- | --- |
| Deep analysis (Stage 2) | Opus-class | quality drives provocation credibility (D16) |
| Provocation (Stage 5) | Opus-class | the existential-quality call |
| Seeding extraction (Stage 3) | Haiku/Sonnet-class | bulk read of commits/PRs; cheap |
| Ranking (Stage 4) | Haiku/Sonnet-class | scoring, not prose |
| Contradiction triage (D11) | Haiku/Sonnet-class | filter; escalate only suspects to Opus |

Cost controls: per-flow token budget; cap onboarding provocations (D19); reuse the append-only `AnalysisArtifact` so deep analysis is paid once, refined cheaply (D7/D8).

---

## Open questions (tune during dogfood)

1. **Flow auto-segmentation accuracy** — how good is heuristic + LLM flow discovery before the human confirm step? Bad segmentation wastes analysis tokens.
2. **Ranking weights & budget size** — the `composite` weights and the `alwaysOn` threshold are guesses; tune against "did the founder engage / did serve catch real mistakes."
3. **Contradiction precision/recall** — the false-positive/false-negative tradeoff (D11). Where to set the triage threshold.
4. **Provocation quality measurement** — the existential metric (D18). Need an actual signal: engage-rate, rationale cleanliness, eye-roll-rate. Define before building far.
5. **Plausible vs dumb** guardrail efficacy — does the self-check pass actually catch dumb provocations? (The D16 bet rides on this.)
