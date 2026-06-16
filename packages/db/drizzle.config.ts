import { defineConfig } from 'drizzle-kit'

// Load env from the repo root whether invoked from there or from packages/db.
for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // no .env at this path — rely on the ambient environment
  }
}

export default defineConfig({
  schema: './src/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
