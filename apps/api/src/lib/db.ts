import { createDb } from '@overstory/db'

// One Drizzle client for the whole API process. Better Auth and the route
// handlers share it (createDb throws if DATABASE_URL is unset — fine for the
// server, which always has it).
export const db = createDb()
