import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { requireEnv } from '@overstory/config'
import { sql } from 'drizzle-orm'
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
    // Neon's pooler endpoint is PgBouncer in transaction mode, where server-side prepared
    // statements don't survive between queries — disable them (also avoids a parse round trip).
    prepare: false,
    idle_timeout: 0, // never close an idle pooled connection client-side (keep it warm to reuse)
  })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>

/**
 * Keep one pooled connection warm against Neon's server-side idle drop. Establishing a fresh
 * Neon connection (TLS + SCRAM + channel binding to a distant region) costs ~3s; reusing a warm
 * one is ~300ms. A small periodic no-op query stops the pooler from closing the idle connection,
 * so navigations after a quiet spell don't re-pay the connect. Call ONCE from a long-lived server
 * entrypoint (apps/api, apps/web server). The timer is unref'd, so it never keeps a process
 * (test/seed/build) alive, and a failed ping is swallowed (a real query will surface DB errors).
 */
export function startDbKeepalive(db: Db, intervalMs = 240_000): () => void {
  const timer = setInterval(() => {
    void db.execute(sql`select 1`).catch(() => {})
  }, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
