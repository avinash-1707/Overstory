// Load .env BEFORE anything reads process.env (createDb, Better Auth secret).
// Imported first in entrypoints (index.ts, seed.ts) — ESM evaluates imports in
// source order, so this side effect runs before lib/db's createDb().
for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // not present at this path — rely on the ambient environment
  }
}
