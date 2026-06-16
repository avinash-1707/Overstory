import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Create a Drizzle client bound to a Postgres connection.
 *
 * Lazy by design — nothing connects at import time, so this package can be
 * imported in contexts (typecheck, tests) where DATABASE_URL is unset.
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  // Neon resolves to IPv4+IPv6; where IPv6 has no route, Node's 250ms Happy
  // Eyeballs attempt timeout fires before the IPv4 handshake lands. Raise it.
  setDefaultAutoSelectFamilyAttemptTimeout(2000)
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
