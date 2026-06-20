import { randomUUID } from 'node:crypto'
import { env } from '@overstory/config'
import { and, eq } from 'drizzle-orm'
import { apiKeys, organization, repos } from '@overstory/db/schema'
import type { WorkspaceId } from '@overstory/db/schema'
import { db } from './lib/db'
import { mintApiKey } from './lib/api-key'

// Dogfood bootstrap: mint one workspace + repo + ApiKey.
// The workspace is inserted directly (full signup/login arrives with the dashboard slice).
//   pnpm --filter @overstory/api seed   (override: SEED_WORKSPACE, SEED_REPO)

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

  console.log(`\n  Workspace : ${WORKSPACE} (${workspaceId})`)
  console.log(`  Repo      : ${REPO} (${repoId})`)
  console.log('\n  API key (shown once — copy into OVERSTORY_API_KEY):\n')
  console.log(`    ${key}\n`)
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
