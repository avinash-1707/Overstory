import '@overstory/config'
import { createDb, startDbKeepalive } from '@overstory/db'

// One Drizzle client for the web server (server functions only — never imported into
// client code). Same shared data layer the Hono api uses (D29). @overstory/config loads +
// validates .env on import, so DATABASE_URL is set before createDb() reads it.
export const db = createDb()

// Keep the pooled Neon connection warm so dashboard data loads reuse it (~300ms) rather than
// re-paying the ~3s connect after a quiet spell. Timer is unref'd, so it never blocks exit.
startDbKeepalive(db)
