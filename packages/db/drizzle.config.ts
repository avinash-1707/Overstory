import { defineConfig } from 'drizzle-kit'

// Load env from the repo root whether invoked from there or from packages/db.
for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // no .env at this path — rely on the ambient environment
  }
}

// Neon recommends a direct (non-pooled) connection for migrations — the pooler
// (PgBouncer) can terminate DDL mid-run. Runtime keeps the pooler URL.
const url = (process.env.DATABASE_URL ?? '').replace('-pooler.', '.')

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
