import { type AnyPgColumn, boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { flows } from './flow'
import { repos } from './repo'
import { captureMethod, decisionStatus } from './_enums'
import { createdAt, ulidPk, updatedAt } from './_columns'
import type { DecisionId, FlowId, RepoId, UserId } from './_ids'
import type { DecisionRanking, Provenance, Rationale } from './_types'

// Decision — the core served unit. Scoped to a flow (human) + pointers (machine), D22.
// Served only in status 'decided'; 'needs_reconfirmation' served flagged; 'superseded' never.
export const decisions = pgTable(
  'decisions',
  {
    id: ulidPk<DecisionId>(),
    repoId: text('repo_id')
      .$type<RepoId>()
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    flowId: text('flow_id')
      .$type<FlowId>()
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    statement: text('statement').notNull(),
    status: decisionStatus('status').default('proposed').notNull(),
    rationale: jsonb('rationale').$type<Rationale>().notNull(), // the WHY (D18)
    alternativesConsidered: text('alternatives_considered').array().notNull().default([]),
    topics: text('topics').array().notNull().default([]), // tags for always-on targeting (D20)
    ranking: jsonb('ranking').$type<DecisionRanking>().notNull(), // D19
    alwaysOn: boolean('always_on').default(false).notNull(), // derived from ranking.composite (D20)
    provenance: jsonb('provenance').$type<Provenance>(), // seeded sources (D18)
    captureMethod: captureMethod('capture_method').notNull(),
    // Supersede, never delete (D11) — self-references.
    supersedesId: text('supersedes_id')
      .$type<DecisionId>()
      .references((): AnyPgColumn => decisions.id, { onDelete: 'set null' }),
    supersededById: text('superseded_by_id')
      .$type<DecisionId>()
      .references((): AnyPgColumn => decisions.id, { onDelete: 'set null' }),
    // Nullable + set null: decisions outlive their author (D11 supersede-never-delete),
    // and a user must be deletable without a FK block.
    createdBy: text('created_by')
      .$type<UserId>()
      .references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('decisions_repo_idx').on(t.repoId),
    index('decisions_flow_idx').on(t.flowId),
    // always-on tier query (D20)
    index('decisions_alwayson_idx').on(t.repoId, t.alwaysOn, t.status),
  ],
)
