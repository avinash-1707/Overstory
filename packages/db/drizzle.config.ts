import { requireEnv } from '@overstory/config'
import { defineConfig } from 'drizzle-kit'

// Neon recommends a direct (non-pooled) connection for migrations — the pooler
// (PgBouncer) can terminate DDL mid-run. Runtime keeps the pooler URL. (.env is loaded
// by @overstory/config on import.)
const url = requireEnv('DATABASE_URL').replace('-pooler.', '.')

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
