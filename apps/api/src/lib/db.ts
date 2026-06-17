import '@overstory/config'
import { createDb } from '@overstory/db'

// One Drizzle client for the whole API process. Better Auth and the route handlers share
// it. @overstory/config (imported first) loads + validates .env, so DATABASE_URL is set
// before createDb() reads it via requireEnv.
export const db = createDb()
