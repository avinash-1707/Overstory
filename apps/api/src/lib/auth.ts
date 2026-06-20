import { createAuth } from '@overstory/core/auth'
import { db } from './db'

// Auth config is shared (D37) in @overstory/core/auth. This file is the Better Auth CLI's
// --config target (exports a concrete `auth` instance).
export const auth = createAuth(db)

export type Auth = typeof auth
