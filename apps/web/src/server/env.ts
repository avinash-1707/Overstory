// Load .env before anything reads process.env (createDb, later Better Auth secret).
// Mirrors apps/api/src/env.ts. CWD is apps/web under `vite dev`, so the repo-root .env
// is at ../../.env. Imported first by server/db.ts (ESM runs side effects in order).
for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // not present at this path — rely on the ambient environment
  }
}
