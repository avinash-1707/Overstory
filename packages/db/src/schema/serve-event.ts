// ServeEvent — MCP call log; powers the dashboard. D28.
// TODO(schema): id, workspaceId, repoId, sessionId, tool
//   (context|guard|check|decision|search), query (jsonb), servedDecisionIds[],
//   conflictDecisionIds[], latencyMs, createdAt.
// D1-safe: IDs + query metadata only, never code. Indexes:
//   serve_events(repo_id, created_at), serve_events(session_id).
export {}
