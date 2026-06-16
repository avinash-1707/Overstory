// Programmatic migrator — applies ./drizzle migrations and surfaces the real
// error (drizzle-kit's `migrate` command swallows DB errors behind a spinner).
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // no .env at this path — rely on the ambient environment
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle')
const sql = postgres(url, { max: 1 })

try {
  await migrate(drizzle(sql), { migrationsFolder })
  console.log('migrations applied')
} catch (err) {
  console.error('migration failed:', err)
  process.exitCode = 1
} finally {
  await sql.end()
}
