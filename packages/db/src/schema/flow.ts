import { index, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { repos } from './repo'
import { createdAt, ulidPk } from './_columns'
import type { AnalysisArtifactId, FlowId, RepoId } from './_ids'

// Flow — scope unit a subagent reasons about; decisions hang off it (D12/D22).
export const flows = pgTable(
  'flows',
  {
    id: ulidPk<FlowId>(),
    repoId: text('repo_id')
      .$type<RepoId>()
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    // Soft pointer to the latest analysis — no hard FK (would cycle with analysis_artifacts.flow_id).
    currentAnalysisId: text('current_analysis_id').$type<AnalysisArtifactId>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('flows_repo_idx').on(t.repoId),
    // One flow name per repo — makes capture idempotent (upsert by name, no dup flows).
    unique('flows_repo_name_uq').on(t.repoId, t.name),
  ],
)
