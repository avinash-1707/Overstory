import { env } from '@overstory/config'
import { createAuth } from '@overstory/core/auth'
import { db } from './db'

// Better Auth for the WEB origin (D37): the shared config from @overstory/core/auth, this
// server's db, and the web's own baseURL. BETTER_AUTH_URL points at the api (:3001), so the
// web origin is set explicitly (override via WEB_BASE_URL). Same BETTER_AUTH_SECRET + DB as
// the api, so a session minted here is valid wherever the cookie travels.
export const auth = createAuth(db, {
  baseURL: env.WEB_BASE_URL ?? 'http://localhost:3000',
})
