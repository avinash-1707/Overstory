#!/usr/bin/env node
// @overstory/cli — local trigger + the dogfood capture answer client.
// Phase 2 (risk-first): run the capture loop on one cold flow and answer provocations.
//
//   overstory capture <flow>   — run analyze -> seed -> rank -> provoke, then answer (defend)
//   overstory analyze <path>   — deep-analyze a flow, print candidate decisions
//
// TODO: commander program + @clack/prompts answer TUI, calling @overstory/core/capture.

async function main() {
  throw new Error('not implemented — scaffold only')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
