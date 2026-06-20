import '@overstory/config'
import { desc, sql } from 'drizzle-orm'
import { serveEvents } from '@overstory/db/schema'
import { db } from './lib/db'

// Dogfood instrument (D28 dashboard precursor). The existential metric (Risk 4) is whether
// the agent issues guard/context calls at all. Run: `pnpm --filter @overstory/api stats`.

async function main(): Promise<void> {
  const byTool = await db
    .select({
      tool: serveEvents.tool,
      calls: sql<number>`count(*)::int`,
      served: sql<number>`coalesce(sum(cardinality(${serveEvents.servedDecisionIds})), 0)::int`,
      avgMs: sql<number>`coalesce(round(avg(${serveEvents.latencyMs})), 0)::int`,
    })
    .from(serveEvents)
    .groupBy(serveEvents.tool)

  console.log('\nServeEvents by tool:')
  if (byTool.length === 0) console.log('  (none yet — no agent has pulled)')
  for (const r of byTool) {
    console.log(`  ${r.tool.padEnd(10)} calls=${r.calls}  served=${r.served}  avgMs=${r.avgMs}`)
  }

  const sessions = await db
    .select({
      session: serveEvents.sessionId,
      calls: sql<number>`count(*)::int`,
      tools: sql<string>`string_agg(distinct ${serveEvents.tool}::text, ',')`,
      served: sql<number>`coalesce(sum(cardinality(${serveEvents.servedDecisionIds})), 0)::int`,
    })
    .from(serveEvents)
    .groupBy(serveEvents.sessionId)
    .orderBy(desc(sql`count(*)`))
    .limit(20)

  console.log('\nRecent sessions (one MCP connection = one agent run):')
  for (const s of sessions) {
    console.log(`  ${s.session.slice(0, 12)}…  calls=${s.calls}  tools=[${s.tools}]  served=${s.served}`)
  }
  console.log()
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
