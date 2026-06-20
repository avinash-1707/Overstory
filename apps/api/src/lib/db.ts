import '@overstory/config'
import { createDb } from '@overstory/db'

// @overstory/config (imported first) loads + validates .env before createDb() reads it.
export const db = createDb()
