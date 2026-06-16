import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { decisions } from './decision'
import { flows } from './flow'
import { provocationOutcome } from './_enums'
import { createdAt, ulidPk } from './_columns'
import type { DecisionId, FlowId, ProvocationId } from './_ids'

// Provocation — capture history (D5/D16). Job: elicit a defense, not be correct.
export const provocations = pgTable(
  'provocations',
  {
    id: ulidPk<ProvocationId>(),
    flowId: text('flow_id')
      .$type<FlowId>()
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    decisionId: text('decision_id')
      .$type<DecisionId>()
      .references(() => decisions.id, { onDelete: 'set null' }), // the decision it produced/confirmed
    alternative: text('alternative').notNull(),
    tradeoffs: text('tradeoffs').notNull(),
    outcome: provocationOutcome('outcome').default('pending').notNull(),
    producedRationale: text('produced_rationale'), // the "no, because Y" we captured
    createdAt: createdAt(),
  },
  (t) => [
    index('provocations_flow_idx').on(t.flowId),
    index('provocations_decision_idx').on(t.decisionId),
  ],
)
