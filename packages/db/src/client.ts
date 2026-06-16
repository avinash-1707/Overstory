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
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
