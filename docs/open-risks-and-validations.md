# Overstory — Open Risks & Validation

> **Status:** Living document. The honest list of what could kill Overstory and how dogfooding probes each. Update as risks close or new ones appear. This is the doc that keeps enthusiasm honest.

---

## The open holes that survived stress-testing

Most objections to Overstory were closed during idea-shaping (see Decisions Log). **Four** remain genuinely open: two survived the original idea-shaping (Risks 1–2), and two more surfaced in deeper stress-testing (Risks 3–4). All four were addressed by _moving_ the problem rather than _closing_ it — which means they're the real work, not settled.

### Risk 1 — Silent decision erosion (the freshness hole)

**The risk.** Persisted rationale is accurate until the code/team moves — then it becomes _confidently wrong_, which is worse than no context. Unlike code staleness (detectable from a diff), a decision can die _silently_: the team quietly stops following the rule, a new lead overrides it, the reason becomes obsolete and nobody updates Overstory. There is no diff that signals a decision died.

**Current mitigation (D11).** Don't try to detect erosion directly — wire freshness to **contradiction events**. When an agent or a PR proposes something that contradicts a stored decision, that's the trigger to re-confirm: "this change goes against a recorded decision — still true?" Turns an unsolvable detection problem into an event-driven check.

**Still unproven.** Whether contradiction-events fire _often enough_ to keep the memory fresh, or whether decisions rot in the gaps between contradictions. Watch during dogfooding: do stored decisions ever go stale without a contradiction catching them?

### Risk 2 — Willingness to pay (the buyer hole)

**The risk.** This is the hole that killed prior ideas. "Agents undo my design decisions" is real pain — but is it _budget-line_ pain, or _mildly-annoying-I'll-just-re-correct-the-agent_ pain? The fix is one prompt away from being worked around manually. A pricing model (free limits → PAYG) is a _mechanism_, not _demand_ — it describes how money would change hands _if_ people want it, not evidence they do.

**Current mitigation.** Dogfooding parks this question — while self-using, we're not selling, so WTP doesn't block progress. Self-use proves the _pain and the loop_, not the _market_.

**Still unproven, and explicitly deferred.** No named buyer who'd pay yet. Before any commercial push: find five developers who say "yes, this wastes my time weekly, I'd pay" — not "neat." Self-use (Experiment A) proves the pain exists _in the founder's own repo_; it does NOT prove someone else would pay. Those are different experiments. The second one is owed before monetization, not before building.

### Risk 3 — Dogfooding can't validate capture (the founder-knows-the-why hole)

**The risk.** Overstory has two halves: **capture** (provoke → defend → extract rationale) and **serve** (feed stored rationale to the agent over MCP). Capture exists to pull the "why" out of a head _before it's lost_. But the founder dogfooding on his own repo already holds every "why" — he authored the dual auth, the pipeline ordering, nothing is forgotten. So dogfooding gives a real test of **serve** (does the agent stop re-making banned choices? measurable) but **not of capture** — the centerpiece (D4). A founder answering a provocation about his own recent decision is _reciting from memory_, not _reconstructing lost intent_; it says nothing about whether the loop extracts well from someone who half-remembers, inherited the code, or never knew. The founder is the **worst possible capture subject** — zero forgotten context. This compounds D16: when you already know the answer, even a weak provocation unlocks it, so dogfooding can't honestly test provocation quality either.

**Mitigation.**

1. **Test the loop on a _cold_ flow.** Run capture on a Kakiyo flow the founder wrote long ago, in a rush, or barely remembers — forcing real reconstruction rather than recitation. Cheapest way to get a true capture signal without recruiting anyone.
2. **Score capture separately from serve.** Don't collapse both into the single "do I keep using it" bar — a strong serve signal will mask an untested capture loop. Track the two questions independently (see updated Validation plan below).

**Still unproven.** Whether capture produces clean, usable rationale for a non-author / fuzzy-intent subject. Fully closing this needs a second subject (another dev, or a dev on code they didn't write) — owed before leaning on capture as the moat, deferred for now.

### Risk 4 — Prevention isn't free: MCP is pull-based (the interception hole)

**The risk.** The headline promise — "keeps agents from undoing intentional design" — reads as _prevention_: stop the banned choice before it's written. But Overstory serves over MCP, which is **pull-based** — the agent consults Overstory only when it decides to. The exact failure we're fixing is that the agent doesn't _know_ a topic is decision-laden, so it never thinks to ask, picks an approach, and the bad change is already written. Default behavior is therefore **catch-after-the-fact, not prevent-during** — a weaker, different product than the headline implies (you still get the bad change, then a flag, then a redo).

**Mitigation (D17).** Two layers on one primitive (file → decisions):

1. **Guard query (best-effort prevent).** Before editing, the agent asks "which decisions touch these paths?", keyed on the files it's about to change — putting the _why_ in context before it picks an approach. Enforced via the MCP tool description + a project rule that tells the agent to consult before editing.
2. **Contradiction check (backstop catch).** D11 at PR/review catches conflicts when the agent skipped the guard query.

**Still unproven.** Whether agents reliably _call_ the guard query (Layer 1) or routinely skip it and fall through to catch (Layer 2). If Layer 1 fires rarely, Overstory is effectively a review-time linter, not a generation-time guardrail — fine, but the positioning must match. Watch during dogfooding: how often does the agent consult Overstory _unprompted_ before editing?

---

## Watch-items (not fatal, but track)

- **Provocation quality band — the engine bet (D16).** Suggestions must be _credible_, not just _provocative_ — a narrow band between "thought-provoking alternative" and "so naive the dev loses respect for the tool." One dumb suggestion early can poison the relationship, and that judgment is sticky. **This is the same axis as D2** (analysis quality), seen from the capture side: a credible alternative requires genuinely understanding the flow. **Resolution (D16):** embrace deep analysis as the internal engine. The explicit bet — provocation needs _plausibility_ ("a smart senior could plausibly suggest this", reachable from a deep flow read), not Greptile-grade _correctness_. A provocation may be _wrong_ and still succeed (D5); it must never be _dumb_. **If plausibility turns out to also require accuracy-grade analysis, the wedge cracks** — this is the first thing to test in build, not a tuning detail. Watch: (a) do provocations make the founder engage or roll their eyes; (b) is the deep-analysis cost per flow sustainable (ties to subagent-run-cost below)?
- **The un-retrievable set is shrinking (see D18).** The "why" isn't un-inferable forever, and it's squeezed from two sides: (a) _retrievability_ — every new MCP connector moves PR threads / commits / tickets into the agent's reach; (b) _inference_ — models get better at reasoning about intent from indirect signals. The durable slice is **head-only** rationale; the rest is a closing timing gap. Mitigation (D18): reposition as _extraction, not storage_, **seed** from the retrievable sources rather than deny them, and bank on the capture loop + freshness + corpus gravity — not on the gap staying open. Watch: how fast does retrievable "why" eat into the provocations Overstory still adds value on?
- **The real competitor is the harness, not the indexer (see D18).** "Repo context over MCP" is occupied (Greptile MCP, Sourcegraph/Cody) — but that's the wrong threat. Overstory's output (decision + rationale + pointer) is a commodity format _identical to a CLAUDE.md / rules-file entry_, and the consumption layer is owned by the harness — which is actively expanding into project memory + rules. The genuine threat: **Claude Code / Cursor ship decision-memory + a capture loop natively**, making Overstory a feature. Defense: cross-harness neutrality (a layer no single platform unifies for its rivals), a loop deeper than a platform bothers to build, and repo-corpus switching cost — or accept "acquired as a feature" as a fine outcome. The differentiator is the capture loop + freshness, never the serving or the artifact.
- **Onboarding fatigue (see D19).** The capture-as-engagement bet (D4) inverts the _feeling_ of documentation, not the _count_. A real repo has hundreds of decisions; provoking on all of them at first ingestion (D8) recreates the chore as a giant onboarding queue, and volume kills engagement. Mitigation (D19): rank + budget — provoke only the vital few (non-obvious × high-blast-radius × tempting-wrong-default), defer the tail to incremental + contradiction-triggered capture, and seed (D18) to cut per-item effort. Watch: does the founder finish the onboarding pass, or abandon it partway?
- **Subagent run cost.** Walking flows with subagents isn't free. Mitigated by onboarding + incremental (D8), but watch the per-flow cost.
- **Pointer drift (D15).** Decisions store pointers to where they apply; a file rename/move/symbol relocation makes the pointer stale even when the decision didn't change. Lower-risk than other freshness problems because it's **diff-detectable** (a rename shows in the diff) — so it's a cheap invalidation event, not a silent failure. Watch: do pointers anchored to symbols/signatures survive refactors better than line-number anchors?

---

## Validation plan (dogfooding)

The bar for the dogfood phase is honest and simple: **does the founder keep using it.** Underneath that, two concrete things to learn:

### Experiment A — Is missing _rationale_ a real class of agent failure?

On Kakiyo, take ~5 agent tasks touching a known non-obvious decision (dual auth, strict pipeline ordering, interrupt/takeover). Run an agent cold. Does it re-make banned choices / violate the unstated rule?

- **Yes, repeatedly** → pain is real, rationale-memory has value.
- **No, the agent figures it out** → rethink.

### Experiment B — Does the provocation loop actually elicit rationale, and is it engaging?

Run the capture loop live on yourself on one flow. When tired and just wanting to code, does defending a decision feel engaging or annoying? Does "no, because X" produce clean, usable rationale or vague mush?

- **Engaging + clean rationale** → capture mechanism works.
- **Annoying / vague** → capture UX needs rethinking before building further.

**Caveat (Risk 3).** Running this on a flow you just authored measures recitation, not extraction — you'll get a false green. Run it on a **cold flow** (written long ago, in a rush, or one you barely remember why) so you're actually reconstructing intent. That's the only version of Experiment B that tests capture honestly until a non-author subject exists.

### The standing signal

Beyond the two experiments: **do you keep opening Overstory after week one?** Sustained self-use is the truest green light. If the most motivated possible user stops feeding the loop, that's the answer.

**But split the signal (Risk 3).** "Do I keep using it" mostly measures **serve value + maintenance willingness** — not **capture value**, because the founder has nothing to reconstruct. Score them as two separate questions so a strong serve signal can't disguise an untested capture loop:

- **(A) Serve:** does the agent stop re-making banned choices once decisions are stored? (testable now)
- **(B) Capture:** does the provocation loop extract clean rationale from someone who _doesn't already know it_? (testable only via a cold flow now, fully only via a second subject later)

---

## What's already de-risked (don't re-litigate)

- Capture quality (D10) — resolved: we record decided/not-decided, not good/bad.
- Over-generalization (D12) — resolved: per-flow subagents.
- Staleness on _code_ change (D6/D7) — largely dodged: rationale is stable.
- The Greptile-accuracy fight (D2) — cut entirely.

The point of listing these: don't let a future bad day re-open settled questions and stall the project. The open holes above (Risks 1–4) are the real ones. Everything else is tuning.
