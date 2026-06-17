import { createAuth } from '@overstory/core/auth'
import { db } from './db'

// Better Auth for the api origin. Config is shared (D37) in @overstory/core/auth; the web
// server instantiates the same config with its own db + baseURL. This file stays the
// Better Auth CLI's --config target (it exports a concrete `auth` instance). See core/auth.
export const auth = createAuth(db)

export type Auth = typeof auth
