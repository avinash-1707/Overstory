import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { schema } from '@overstory/db'
import { db } from './db'

// Better Auth — the source of truth for the AUTH schema (D26).
// organization plugin -> organization = Workspace, member = users, invitation (D23).
// MCP + CLI credentials are a DOMAIN table (apiKey, see schema/api-key.ts) — Better Auth
// 1.6 has no apiKey plugin; the `mcp` plugin (OAuth) is a later option if we move off keys.
//
// Regenerate the Drizzle auth tables after changing plugins/fields:
//   DATABASE_URL=postgresql://localhost/x \
//     pnpm dlx @better-auth/cli@latest generate \
//       --config apps/api/src/lib/auth.ts \
//       --output packages/db/src/schema/auth.ts -y

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  plugins: [organization()],
})

export type Auth = typeof auth
