import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { organization } from './auth'
import { createdAt, ulidPk } from './_columns'
import type { RepoId, WorkspaceId } from './_ids'

// Repo — a codebase under a workspace. Workspace = Better Auth organization (D23/D26/D27).
export const repos = pgTable(
  'repos',
  {
    id: ulidPk<RepoId>(),
    workspaceId: text('workspace_id')
      .$type<WorkspaceId>()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    remoteUrl: text('remote_url'), // accessed read-only via GitHub App (D27)
    primaryLanguage: text('primary_language').default('typescript').notNull(), // one-ecosystem-first (D9)
    createdAt: createdAt(),
  },
  (t) => [
    index('repos_workspace_idx').on(t.workspaceId),
    uniqueIndex('repos_workspace_name_uidx').on(t.workspaceId, t.name),
  ],
)
