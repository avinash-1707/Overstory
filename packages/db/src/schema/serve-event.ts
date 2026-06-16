import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { organization } from './auth'
import { repos } from './repo'
import { mcpTool } from './_enums'
import { createdAt, ulidPk } from './_columns'
import type { DecisionId, RepoId, ServeEventId, WorkspaceId } from './_ids'
import type { ServeQuery } from './_types'

// ServeEvent — MCP call log; powers the dashboard (D28). One row per tool call.
// D1-safe: decision IDs + query metadata only, never code.
export const serveEvents = pgTable(
  'serve_events',
  {
    id: ulidPk<ServeEventId>(),
    workspaceId: text('workspace_id')
      .$type<WorkspaceId>()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    repoId: text('repo_id')
      .$type<RepoId>()
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(), // one MCP connection = one agent session
    tool: mcpTool('tool').notNull(),
    query: jsonb('query').$type<ServeQuery>().notNull(),
    servedDecisionIds: text('served_decision_ids').array().$type<DecisionId[]>().notNull().default([]),
    conflictDecisionIds: text('conflict_decision_ids').array().$type<DecisionId[]>().notNull().default([]),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('serve_events_repo_created_idx').on(t.repoId, t.createdAt), // dashboard activity (D28)
    index('serve_events_session_idx').on(t.sessionId), // session timeline
  ],
)
