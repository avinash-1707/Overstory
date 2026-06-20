import { randomUUID } from 'node:crypto'
import { env } from '@overstory/config'
import { createAuth } from '@overstory/core/auth'
import { and, eq } from 'drizzle-orm'
import { apiKeys, member, organization, repos, user } from '@overstory/db/schema'
import type { WorkspaceId } from '@overstory/db/schema'
import { db } from './lib/db'
import { mintApiKey } from './lib/api-key'

// Dogfood bootstrap: mint one workspace + repo + ApiKey, and (optionally) an operator account.
// The workspace is inserted directly. The operator (a Better Auth user + member row) is what lets
// the human dashboard resolve a tenant from the session (D36) — created only when both
// SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD are set.
//   pnpm --filter @overstory/api seed
//   overrides: SEED_WORKSPACE, SEED_REPO, SEED_OPERATOR_EMAIL/PASSWORD/NAME

const WORKSPACE = env.SEED_WORKSPACE ?? 'Dogfood'
const REPO = env.SEED_REPO ?? 'overstory'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main(): Promise<void> {
  const slug = slugify(WORKSPACE)
  const existingOrg = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1)

  let workspaceId: WorkspaceId
  if (existingOrg[0]) {
    workspaceId = existingOrg[0].id as WorkspaceId
  } else {
    const inserted = await db
      .insert(organization)
      .values({ id: randomUUID(), name: WORKSPACE, slug, createdAt: new Date() })
      .returning({ id: organization.id })
    if (!inserted[0]) throw new Error('failed to create workspace')
    workspaceId = inserted[0].id as WorkspaceId
  }

  const existingRepo = await db
    .select({ id: repos.id })
    .from(repos)
    .where(and(eq(repos.workspaceId, workspaceId), eq(repos.name, REPO)))
    .limit(1)

  let repoId = existingRepo[0]?.id
  if (!repoId) {
    const inserted = await db
      .insert(repos)
      .values({ workspaceId, name: REPO })
      .returning({ id: repos.id })
    if (!inserted[0]) throw new Error('failed to create repo')
    repoId = inserted[0].id
  }

  const { key, hashedKey, prefix } = mintApiKey()
  await db.insert(apiKeys).values({ workspaceId, repoId, hashedKey, prefix, label: 'dogfood cli+mcp' })

  const operatorId = await ensureOperator(workspaceId)

  console.log(`\n  Workspace : ${WORKSPACE} (${workspaceId})`)
  console.log(`  Repo      : ${REPO} (${repoId})`)
  if (operatorId) console.log(`  Operator  : ${env.SEED_OPERATOR_EMAIL} (${operatorId})`)
  console.log('\n  API key (shown once — copy into OVERSTORY_API_KEY):\n')
  console.log(`    ${key}\n`)
  process.exit(0)
}

// Provision the operator: a Better Auth user (credential account, correctly hashed) + a member
// row in the dogfood org, so the dashboard's session->member->repo resolution (D36) finds a
// tenant. Idempotent — safe to re-run. Returns the operator's userId, or null if unconfigured.
async function ensureOperator(workspaceId: WorkspaceId): Promise<string | null> {
  const email = env.SEED_OPERATOR_EMAIL
  const password = env.SEED_OPERATOR_PASSWORD
  if (!email || !password) return null

  // Force sign-up ON in this in-process auth instance only — the public default stays whatever
  // OVERSTORY_OPEN_SIGNUP says (the seed must mint the operator even while sign-up is closed).
  const seedAuth = createAuth(db, { disableSignUp: false })

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  let userId = existing?.id
  if (!userId) {
    const res = await seedAuth.api.signUpEmail({
      body: { email, password, name: env.SEED_OPERATOR_NAME ?? 'Operator' },
    })
    userId = res.user.id
  }

  const [hasMember] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)))
    .limit(1)
  if (!hasMember) {
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: workspaceId,
      userId,
      role: 'owner',
      createdAt: new Date(),
    })
  }
  return userId
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
