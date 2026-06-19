import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { requireEnv } from '@overstory/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Create a Drizzle client bound to a Postgres connection.
 *
 * Lazy by design — nothing connects at import time, so this package can be
 * imported in contexts (typecheck, tests) where DATABASE_URL is unset.
 */
export function createDb(connectionString = requireEnv('DATABASE_URL')) {
  // Neon resolves to IPv4+IPv6; where IPv6 has no route, Node's 250ms Happy
  // Eyeballs attempt timeout fires before the IPv4 handshake lands. Raise it.
  setDefaultAutoSelectFamilyAttemptTimeout(2000)
  // Fail fast instead of hanging. Without connect_timeout an unreachable DB makes every query
  // (incl. the auth-middleware key lookup on the hot path) hang for the OS TCP timeout, filling
  // the event loop under load. statement_timeout caps any single query server-side. (audit H1)
  const client = postgres(connectionString, {
    connect_timeout: 5, // seconds
    connection: { statement_timeout: 30_000 }, // ms — Postgres GUC, aborts runaway queries
  })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
