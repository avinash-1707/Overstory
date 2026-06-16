import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { apiKeys } from '@overstory/db/schema'
import type { ApiKeyId, RepoId, WorkspaceId } from '@overstory/db/schema'
import { db } from '../lib/db'
import { bearerFromHeader, hashKey } from '../lib/api-key'

// What every authenticated request carries. The tenant boundary: all downstream
// queries scope to workspaceId/repoId from here, never from client input. D26/D30.
export interface AuthContext {
  workspaceId: WorkspaceId
  repoId: RepoId | null // null = a workspace-wide key (not usable for repo-scoped serving)
  apiKeyId: ApiKeyId
}

export type AuthVars = { auth: AuthContext }

// ApiKey auth for machine clients (CLI, MCP). Bearer `osk_…` → SHA-256 → indexed
// lookup → attach {workspaceId, repoId}. 401 on missing/invalid/expired.
export const apiKeyAuth = createMiddleware<{ Variables: AuthVars }>(async (c, next) => {
  const token = bearerFromHeader(c.req.header('authorization'))
  if (!token) return c.json({ error: 'missing bearer api key' }, 401)

  const [row] = await db
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      repoId: apiKeys.repoId,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.hashedKey, hashKey(token)))
    .limit(1)

  if (!row) return c.json({ error: 'invalid api key' }, 401)
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return c.json({ error: 'api key expired' }, 401)
  }

  c.set('auth', { workspaceId: row.workspaceId, repoId: row.repoId, apiKeyId: row.id })

  // Touch last-used out of band — never block or fail the request on it.
  void (async () => {
    try {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id))
    } catch {
      // ignore — telemetry, not correctness
    }
  })()

  await next()
})
