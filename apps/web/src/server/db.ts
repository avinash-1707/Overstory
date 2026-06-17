import './env'
import { createDb } from '@overstory/db'

// One Drizzle client for the web server (server functions only — never imported into
// client code). Same shared data layer the Hono api uses (D29). env.ts ran first, so
// DATABASE_URL is set before createDb() reads it.
export const db = createDb()
