# Overstory — Glossary

> **Status:** Living document. Pins every Overstory term to one exact meaning so technical docs don't drift. If a term starts meaning two things, fix it here first.

---

**Overstory**
The product. A decision-and-rationale memory for a codebase that captures the architectural "why" not present in code and serves it to coding agents over MCP. Named for the _overstory_ — the topmost layer of a forest that governs everything growing below it.

**Decision** _(core unit)_
A recorded, intentional design choice about a codebase — e.g. "auth is split into widget JWT vs dashboard BetterAuth." A decision is _decided/not-decided_, never _good/bad_. An unconventional choice the developer deliberately keeps is just as valid a decision as a conventional one (see D10). Decisions are the atoms Overstory stores.

**Rationale**
The _why_ behind a decision — the reasoning the code's syntax never states. May have lived in a PR discussion, a Slack thread, a commit message, or someone's head. The durable, uncopyable part is **head-only** rationale (see _Head-only knowledge_); rationale that lives in retrievable sources is increasingly the agent's to fetch, so Overstory **seeds** from it rather than competing to store it (D18). _Extracting_ rationale — especially the head-only slice — is Overstory's central value; storing and serving it are plumbing.

**Head-only knowledge** _(the durable moat)_
Rationale that exists in no retrievable artifact — not in code, comments, commits, PRs, tickets, or docs — only in a human's head. The one slice nothing can fetch and no model can infer, and therefore the only structurally defensible _input_ (D18). The honest axis for what Overstory owns is **already-externalized-anywhere vs head-only**, not _in-code vs not-in-code_. Everything outside head-only is a timing gap that closes as MCP connectors and models improve.

**Seeding** _(retrievable sources as asset, not threat)_
Reading the retrievable "why" — commit messages, PR threads, tickets, ADRs — to build the deep analysis, draft credible provocations, and pre-fill draft rationale, so the human is asked only for the **head-only delta** (D18). Inverts the shrinking-un-retrievable-set risk: the more "why" already exists in retrievable form, the better Overstory's provocations and the smaller the capture burden. Distinct from _storing_ those sources — Overstory reads them to extract, it does not cache them (consistent with D1).

**Flow** _(scope unit)_
A feature or path through the codebase that a subagent reasons about as a unit — e.g. "the inbound message → AI pipeline flow." Subagents are scoped to flows, not the whole software, to avoid over-generalizing (D12). Whether a _decision_ is scoped to a flow or to files/modules is still open (see data-model doc).

**Provocation**
A subagent-generated alternative + tradeoffs presented to the developer for a flow — "here's what you have; here's a different approach and its tradeoffs." Its job is to **elicit a defense, not to be correct** (D5). A provocation that's "wrong" but triggers "no, because X" still succeeds, because X is the rationale we wanted.

**Deep analysis** _(internal engine — the means, not the value)_
The genuine flow-level understanding Overstory builds so its provocations are _credible_. Reaching plausibility (not Greptile-grade correctness) still requires real analysis, so we do it internally (D16). Persisted as an **append-only artifact**: built deeply at the onboarding pass, refined incrementally on modification, never re-derived wholesale. Distinct from "analysis as the value" — see _Terms we deliberately DON'T use_. The data structure for storing/appending it is deferred to the technical docs.

**Capture loop** _(the centerpiece)_
The mechanism by which rationale gets into Overstory: subagent infers → provokes → developer accepts (new direction) or rejects-with-reason (decision locked + rationale captured) → persist. Inverts "documentation chore" into "a review the developer engages with" (D4). A rejection is a confirmation.

**Accept / Reject-with-reason**
The two outcomes of a provocation. **Accept** = the developer wants the suggested change; Overstory learns the new/intended direction. **Reject-with-reason** = the developer keeps the current design and says why; Overstory locks the decision as final and captures the defense as rationale.

**Ingestion**
The process of building Overstory's memory for a repo. **First ingestion** (onboarding pass) walks the major flows and captures foundational decisions. Design choices are captured at first ingestion; change-suggestions only appear later if the developer wants to change something (D10).

**Onboarding pass vs. incremental pass**
**Onboarding pass** = the one-time first ingestion that builds foundational decision memory — **ranked and budgeted, not exhaustive**: it provokes only the _vital few_ decisions (non-obvious × high-blast-radius × tempting-wrong-default), deferring the long tail to incremental passes + contradiction events to avoid onboarding fatigue (D19). **Incremental pass** = per-PR / per-new-flow updates that grow the memory without re-reviewing everything (D8).

**Vital few** _(decision ranking)_
The small subset of a repo's decisions worth provoking on at onboarding — ranked by **non-obviousness × blast radius × banned-default proximity** (D19). Skips conventional choices an agent gets right anyway; prioritizes cross-cutting, high-impact decisions where a tempting _wrong_ default is exactly what an agent would pick. The top slice of the vital few also forms the always-on serving tier (D20).

**Contradiction event** _(freshness trigger)_
The moment an agent or a PR proposes something that _contradicts_ a stored decision. Overstory's freshness signal: rather than trying to detect silent decision-erosion directly (which has no diff), it re-confirms a decision when a contradiction surfaces — "this goes against a recorded decision, still true?" (D11).

**Decision erosion / staleness**
When a stored decision quietly becomes false — the team stops following it, a lead overrides it, the reason goes obsolete — with no diff to signal the change. The hardest open freshness risk; mitigated (not solved) by contradiction events. See Open Risks doc.

**Serve / MCP serving**
Exposing Overstory's persisted decisions + rationale as an MCP server, so any coding agent (Claude Code, Cursor, Codex) can read the "why" and stop re-making banned choices. MCP is **pull-based** — the agent reads only when it chooses to — so serving alone yields _catch-after_, not _prevent-during_; prevention is best-effort and depends on the agent issuing a **guard query** before editing (D17). Serving is _not_ the differentiator — it's table stakes (occupied by existing indexers); nor is the decision/rationale _artifact_, which is a commodity format (D18). The differentiator is the **capture loop + freshness + accumulated corpus**.

**Refined context**
The small, decided set of intentional choices Overstory serves — as opposed to the full, noisy codebase an agent could read live. The value is the refinement — a product of the capture loop — not the storage or the serving (D18 treats those as plumbing).

**ServeEvent** _(the MCP call log)_
One row written per MCP tool call — tool, query, served decision IDs, any conflict IDs, session id, timestamp (D28). Stores IDs + query metadata, **never code** (consistent with D1 — served payloads are why+where, D15). The data behind the dashboard; see `data-model.md` for the shape.

**Activity dashboard** _(the dogfood instrument)_
The web view that visualizes what the coding agent pulled over MCP, built on `ServeEvent` (D28). Two co-equal halves: **Activity** (derived metrics) and **Sessions** (per-session timeline of exactly what one agent run received). Not UI candy — it's the only honest way to _measure_ Risk 4 (does the agent consult before editing?) and the serve signal (Risk 3A). Lives in the same web app as the capture client (D29). See `dashboard.md`.

**Consult-rate** _(the Risk-4 headline metric)_
Of agent runs that touched decision-bearing files, the share that issued a covering `guard` query _before_ the change landed (D28). The honest measure of whether prevention (D17) actually fires or whether Overstory is really a review-time linter (catch-only). Computed as a join of `ServeEvent(guard)` against touched files (PR diffs); low consult-rate forces the positioning to follow the data (Risk 4).

**Pointer** _(code reference, not code storage)_
A reference a decision carries to _where it applies_ in the codebase — file paths, symbol names, or durable anchors. The agent uses the pointer to jump straight to the relevant code and read it _live_, eliminating the expensive repo-wide search it would otherwise do to locate the decision's subject. Overstory stores the **address**, never the **contents** (this is consistent with D1, not a reversal). The division of labor: Overstory serves the _why_ (rationale) + _where_ (pointer); the agent fetches the _what_ (live code). The pointer is **bidirectional** (D17): _decision → file_ powers navigation (D15); the reverse index _file → decisions_ powers interception (the guard query and the contradiction check). One path↔decision index, served both ways.

**Guard query** _(best-effort prevention)_
The query the agent issues _before editing_ — "which decisions touch these files?" — keyed on the files it's about to change, so the relevant rationale lands in context before it picks an approach (D17). Sits on the reverse pointer index (file → decisions). Best-effort, not guaranteed: MCP is pull-based, so it only fires if the agent actually consults Overstory first (enforced via the MCP tool description + a project rule). The contradiction check is the backstop when the guard query is skipped. The guard query is the **on-demand tier** of serving — see _Serving tiers_.

**Serving tiers** _(how decisions reach the agent — D20)_
Two tiers, to keep context refined (D3) while still steering fuzzy tasks. **Always-on tier** = the few highest-blast-radius, cross-cutting decisions (the top of the _vital few_ ranking, D19), injected at session start regardless of task — so the agent is steered even before it picks files, and need not _know to ask_ (partly addresses the pull-based gap, Risk 4). **On-demand tier** = the file→decision guard query (D17), returning only decisions scoped to the locus the agent is touching. Never the full decision set — always-on is tiny, on-demand is locus-filtered.

**Pointer drift**
When a pointer goes stale because a file was renamed/moved or a symbol relocated — even though the underlying _decision_ didn't change. Handled by anchoring pointers to durable references (symbols/signatures over line numbers) and treating file-move/rename as a cheap, **diff-detectable** invalidation event (unlike silent decision-erosion, which has no diff). The freshness cost of pointers is small because file moves are rare and detectable.

**Banned choice / undoing intentional design**
The core failure Overstory prevents: an agent reintroducing a pattern the team deliberately avoided, or undoing a deliberate structural decision, because nothing in the code told it the choice was intentional.

---

## Terms we deliberately DON'T use (and why)

- **"Documentation"** — Overstory is not docs; it's a memory fed by engagement, not a chore. Avoid framing that smells like documentation.
- **"Analysis" (as the value)** — Overstory does not _sell_ analysis quality, and does not fight Greptile on accuracy as the product (D2). It _does_ do deep analysis **internally** as the engine that makes provocations credible (D16) — analysis is the means, never the pitch. Avoid framing analysis as the value prop; the value is the captured decisions + rationale, not the analysis that surfaces them.
- **"Cache"** — Overstory does not cache code (D1). Avoid; it implies storing what agents already fetch well.
