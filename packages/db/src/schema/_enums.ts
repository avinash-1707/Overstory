import { pgEnum } from 'drizzle-orm/pg-core'

// Closed-set enums, enforced at the DB level (data-model.md lifecycles).

export const decisionStatus = pgEnum('decision_status', [
  'proposed',
  'decided',
  'needs_reconfirmation',
  'superseded',
])

export const captureMethod = pgEnum('capture_method', ['provoked', 'seeded_confirmed', 'manual'])

// Note: Rationale.capturedFrom ('reject' | 'accept' | 'seed_confirmed') lives inside the
// `rationale` jsonb column (see _types.ts), so it is not a pgEnum.

export const pointerKind = pgEnum('pointer_kind', ['file', 'symbol', 'anchor'])

export const driftStatus = pgEnum('drift_status', ['fresh', 'drifted', 'unresolved'])

export const provocationOutcome = pgEnum('provocation_outcome', [
  'accepted',
  'rejected_with_reason',
  'pending',
])

export const contradictionTrigger = pgEnum('contradiction_trigger', ['agent_edit', 'pr', 'manual'])

export const contradictionResolution = pgEnum('contradiction_resolution', [
  'still_true',
  'superseded',
  'pending',
])

export const mcpTool = pgEnum('mcp_tool', ['context', 'guard', 'check', 'decision', 'search'])
