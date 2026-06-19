import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { organization } from './auth'
import { repos } from './repo'
import { createdAt, ulidPk } from './_columns'
import type { ApiKeyId, RepoId, WorkspaceId } from './_ids'

// ApiKey — authenticates the MCP server + CLI, scoped to workspace + repo (D26).
// Domain table (Better Auth 1.6 has no apiKey plugin). Security: only the hash is stored;
// `prefix` is shown to the user for identification, the plaintext key is never persisted.
export const apiKeys = pgTable(
  'api_keys',
  {
    id: ulidPk<ApiKeyId>(),
    workspaceId: text('workspace_id')
      .$type<WorkspaceId>()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    repoId: text('repo_id')
      .$type<RepoId>()
      .references(() => repos.id, { onDelete: 'cascade' }), // null = workspace-wide
    hashedKey: text('hashed_key').notNull().unique(),
    prefix: text('prefix').notNull(),
    label: text('label'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }), // set to kill a key NOW, before expiry (audit M9)
    createdAt: createdAt(),
  },
  (t) => [
    index('api_keys_workspace_idx').on(t.workspaceId),
    index('api_keys_repo_idx').on(t.repoId),
  ],
)
