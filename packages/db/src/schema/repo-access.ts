import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { repos } from './repo'
import { ulidPk } from './_columns'
import type { RepoAccessId, RepoId } from './_ids'

// RepoAccess — GitHub App installation, read-only least-privilege (D27).
// Security: store only installationId; mint short-lived tokens from a KMS-held app key.
export const repoAccess = pgTable(
  'repo_access',
  {
    id: ulidPk<RepoAccessId>(),
    repoId: text('repo_id')
      .$type<RepoId>()
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    provider: text('provider').default('github').notNull(),
    installationId: text('installation_id').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(['contents:read', 'pull_requests:read']),
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('repo_access_repo_idx').on(t.repoId)],
)
