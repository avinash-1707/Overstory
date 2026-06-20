import { createMiddleware } from 'hono/factory'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { apiKeys } from '@overstory/db/schema'
import type { ApiKeyId, RepoId, WorkspaceId } from '@overstory/db/schema'
import { db } from '../lib/db'
import { bearerFromHeader, hashKey } from '../lib/api-key'
import { log } from '../lib/log'

// What every authenticated request carries. The tenant boundary: all downstream
// queries scope to workspaceId/repoId from here, never from client input. D26/D30.
export interface AuthContext {
  workspaceId: WorkspaceId
  repoId: RepoId | null // null = a workspace-wide key (not usable for repo-scoped serving)
  apiKeyId: ApiKeyId
}

export type AuthVars = { auth: AuthContext }

// Granularity for the last-used touch — a chatty MCP session would otherwise UPDATE one hot row
// on every call (write storm + MVCC bloat on Neon). 60s is plenty for telemetry (audit M10).
const LAST_USED_THROTTLE_MS = 60_000

export const apiKeyAuth = createMiddleware<{ Variables: AuthVars }>(async (c, next) => {
  const token = bearerFromHeader(c.req.header('authorization'))
  if (!token) return c.json({ error: 'missing bearer api key' }, 401)

  const [row] = await db
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      repoId: apiKeys.repoId,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.hashedKey, hashKey(token)))
    .limit(1)

  if (!row) return c.json({ error: 'invalid api key' }, 401)
  if (row.revokedAt) return c.json({ error: 'api key revoked' }, 401)
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return c.json({ error: 'api key expired' }, 401)
  }

  c.set('auth', { workspaceId: row.workspaceId, repoId: row.repoId, apiKeyId: row.id })

  // Touch last-used out of band — never block or fail the request on it. Throttled (M10): only
  // write when the stored timestamp is null or older than the window, so a burst of calls on one
  // key collapses to ~1 write/min instead of a write storm + MVCC bloat on the hot row.
  void (async () => {
    try {
      const cutoff = new Date(Date.now() - LAST_USED_THROTTLE_MS)
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(
          and(eq(apiKeys.id, row.id), or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, cutoff))),
        )
    } catch (err) {
      // ignore — telemetry, not correctness; surface at debug only (no key material, just the error)
      log.debug('api-key last-used touch failed', { err, apiKeyId: row.id })
    }
  })()

  await next()
})
