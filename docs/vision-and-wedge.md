# Overstory — Vision & Wedge

> **Status:** Pre-build, dogfooding phase. This doc defines what Overstory is and why it exists. Read this first.

---

## One-liner

Coding agents know _what_ your code does but not _why_ it's built that way — so they confidently re-make decisions you deliberately avoided. Overstory captures the architectural "why" that never lived in the code, serves it to agents over MCP, and keeps agents from undoing intentional design.

## The name

In forestry, the _overstory_ is the topmost layer of a forest — the canopy stratum that shades and governs everything growing below it. Overstory sits _above_ the code in exactly that sense: it doesn't replace or re-derive the code, it preserves the intentional design that the code embodies but never states, and the agent works underneath that governing layer.

---

## The problem

Coding agent harnesses (Claude Code, Cursor, Codex) are good at fetching and understanding code that _exists_ in the repo — and getting better. What they cannot do is recover the knowledge that was **never in the code's syntax**:

- _Why_ is auth split into two systems? The code shows that it is; nothing says why, or which one is right for a new endpoint.
- The cross-cutting rule "every inbound message must hit the pipeline in strict order" — enforced nowhere in a single readable place.
- "We don't use pattern X because it broke Y" — that lived in a PR discussion or someone's head.

Some of this is _technically_ retrievable today (commit messages, PR threads, tickets) — but noisily, expensively, and unreliably; and the durable slice lives only in a head, where nothing can fetch it (see _The core insight_ for the honest cut). So in practice the agent _guesses_ — and guesses wrong, reintroducing patterns you banned, undoing deliberate structure, violating invariants. The developer then re-corrects the agent, every session, forever.

## What Overstory does

Overstory is a **decision-and-rationale memory** for a codebase:

1. **Infers** architectural decisions from code (subagents walk a flow/feature).
2. **Provokes** the developer with alternatives + tradeoffs — not to be right, but to elicit a defense.
3. **Captures** the response: accept (new direction) or reject-with-reason (decision locked + rationale).
4. **Persists** the confirmed decisions + rationale — the "why" the code never states.
5. **Serves** it over MCP so any coding agent inherits the "why" and stops re-making banned choices — _prevented_ when the agent consults Overstory before editing, _caught_ at review when it didn't (see _Prevent vs. catch_ below).

### Prevent vs. catch (an honest framing)

"Stops re-making banned choices" happens at two points, and it's worth being honest about which. MCP is **pull-based** — the agent reads Overstory only when it chooses to, and the core failure is that it doesn't _know_ a topic is decision-laden, so left alone it never asks.

- **Prevent (generation time)** — best-effort. Before editing, the agent issues a _guard query_ ("which decisions touch these files?"), so the "why" lands in context before it picks an approach. Depends on the agent actually consulting Overstory first; not guaranteed.
- **Catch (review time)** — backstop. When the agent skips the guard query, a contradiction check at PR flags the conflict against stored decisions (D11).

Both run on the same primitive — _given a code location, which decisions apply_ — the reverse of the D15 pointer. So Overstory is best described as **"prevents where the agent consults before acting; catches the rest at review,"** not "the agent never errs." (D17)

## Who it's for (target market)

Solo founders, solo developers, and small startup teams/engineers — people running real codebases with non-obvious design decisions, working heavily with coding agents, who feel the pain of the agent undoing intentional design. (Buyer validation is explicitly unproven — see `open-risks-and-validations.md`.)

---

## The wedge — what Overstory is NOT

These cuts are deliberate and load-bearing. Each one keeps Overstory out of a fight it can't win.

- **NOT a code cache.** We do not store code syntax to save retrieval calls. Agents fetch live code fast and accurately; caching it serves stale copies of something the agent reads correctly in milliseconds. We store only what _isn't_ in the code.
- **NOT Greptile-grade analysis.** We do not compete on analysis accuracy (race-condition detection, deep static analysis). Unwinnable cold against a funded team. We sidestep it entirely.
- **NOT a documentation chore.** We never ask "please document your architecture." That's the version that dies. Capture is inverted into a review the developer actually engages with.

## The core insight

| Lives IN the code (agents fetch well — DON'T store) | Does NOT live in the code (agents can't re-derive — THIS is Overstory) |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| What a function does                                | _Why_ it's built this way                                              |
| Call graph, types, structure                        | Cross-cutting invariants spanning many files                           |
| Where something is used                             | Decisions and their boundaries ("we don't do X because Y")             |
|                                                     | Conventions the code embodies but never states                         |

Agents own the left column and it's getting stronger. Overstory owns the right column — the knowledge the code never states.

**The honest cut (refined — see D18).** "In the code vs not in the code" is too coarse: much of the right column is _technically_ retrievable from elsewhere — commit messages, PR threads, tickets, ADRs — and every new MCP connector and smarter model moves another row into the agent's reach. The axis that actually holds is **already-externalized-anywhere (retrievable, eventually) vs head-only (retrievable by nothing).** The durable, uncopyable slice is head-only rationale. Everything else is a timing gap that closes as connectors and models improve.

This reframes the product as **extraction, not storage.** The hard, defensible thing is getting head-only "why" out of a reluctant human without it feeling like documentation — the capture loop (D4) + deep-analysis credibility (D16) + freshness (D11). Storage and MCP serving are necessary plumbing, not the moat (D18) — we still store (decisions + rationale + pointers, never code, per D1); storage just isn't what makes Overstory hard to copy. And the retrievable sources are an _asset_, not a threat: Overstory **seeds** from them — reading commits/PRs/tickets to build the analysis, draft credible provocations, and pre-fill rationale — then asks the human only for the head-only delta. The more "why" already exists in retrievable form, the better the provocations and the smaller the human's burden.

## Why refined context beats "the agent reads everything"

An agent _can_ read the whole repo — but that's expensive and noisy. Overstory serves _refined, decided_ context: the small set of intentional choices that matter, not the full codebase. The value is the refinement — the curated decided set the capture loop produces — not the storage or the serving (D18).

It goes one step further to kill the token cost of _locating_ relevant code: each decision carries a **pointer** to where it applies (file paths / symbols / anchors). So the agent gets _why_ (rationale) + _where_ (pointer) in a cheap payload, then spends tokens reading only the _what_ — the live code at that exact location — instead of burning a hefty amount of tokens searching the whole repo to find it. Overstory stores the **address**, never the **contents**: the code read is always live and never stale (consistent with D1 — this is navigation, not caching).

---

## Current phase

Overstory is in **dogfooding**: built for and used by the founder first, on the Kakiyo codebase (a repo with known non-obvious decisions: dual auth, strict pipeline ordering, interrupt/takeover distinction). The bar for "it's working" is simple and honest — _does the founder keep using it_ (read as two signals, serve and capture, per Open Risks → Risk 3). If the most motivated possible user won't feed the loop, no buyer would. Selling comes later, only if self-use proves the loop has lasting value.
