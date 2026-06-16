import { type AnyPgColumn, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { flows } from './flow'
import { createdAt, ulidPk } from './_columns'
import type { AnalysisArtifactId, FlowId } from './_ids'
import type { AnalysisContent, Provenance } from './_types'

// AnalysisArtifact — engine layer, append-only, NEVER served to agents (D16).
export const analysisArtifacts = pgTable(
  'analysis_artifacts',
  {
    id: ulidPk<AnalysisArtifactId>(),
    flowId: text('flow_id')
      .$type<FlowId>()
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    version: integer('version').default(1).notNull(), // append-only; new version on refine
    supersedesVersionId: text('supersedes_version_id')
      .$type<AnalysisArtifactId>()
      .references((): AnyPgColumn => analysisArtifacts.id, { onDelete: 'set null' }),
    content: jsonb('content').$type<AnalysisContent>().notNull(),
    seededFrom: jsonb('seeded_from').$type<Provenance>(),
    createdAt: createdAt(),
  },
  (t) => [index('analysis_artifacts_flow_idx').on(t.flowId)],
)
