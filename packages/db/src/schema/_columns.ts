import { text, timestamp } from 'drizzle-orm/pg-core'
import { ulid } from 'ulid'

// Reusable column builders. Each call returns a FRESH builder — Drizzle forbids
// reusing one column instance across tables.

/** ULID text primary key, branded to the entity's id type. */
export function ulidPk<T extends string>() {
  return text('id')
    .$type<T>()
    .primaryKey()
    .$defaultFn(() => ulid() as T)
}

/** `created_at` — timezone-aware, defaults to now. */
export const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

/** `updated_at` — timezone-aware, bumped on every update. */
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
