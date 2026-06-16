import { type AnyPgColumn, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { decisions } from './decision'
import { contradictionResolution, contradictionTrigger } from './_enums'
import { ulidPk } from './_columns'
import type { ContradictionEventId, DecisionId } from './_ids'

// ContradictionEvent — the freshness trigger (D11). Fires when a change contradicts a decision.
export const contradictionEvents = pgTable(
  'contradiction_events',
  {
    id: ulidPk<ContradictionEventId>(),
    decisionId: text('decision_id')
      .$type<DecisionId>()
      .notNull()
      .references(() => decisions.id, { onDelete: 'cascade' }),
    trigger: contradictionTrigger('trigger').notNull(),
    detail: text('detail').notNull(),
    changedFiles: text('changed_files').array().notNull().default([]),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    resolution: contradictionResolution('resolution').default('pending').notNull(),
    resolvedDecisionId: text('resolved_decision_id')
      .$type<DecisionId>()
      .references((): AnyPgColumn => decisions.id, { onDelete: 'set null' }), // the new decision, if superseded
  },
  (t) => [index('contradiction_events_decision_idx').on(t.decisionId)],
)
