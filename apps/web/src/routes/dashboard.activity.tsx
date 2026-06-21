import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ConsultRateHero, StatCard, MiniBarChart, DecisionRankList } from '../components/Activity'
import { PageHeader } from '../components/ui'
import { DashboardSkeleton } from '../components/DashboardSkeleton'
import { metricsQuery } from '../lib/queries'

export const Route = createFileRoute('/dashboard/activity')({
  loader: ({ context }) => context.queryClient.ensureQueryData(metricsQuery('all')),
  pendingComponent: DashboardSkeleton,
  component: ActivityPage,
})

function ActivityPage() {
  const { data: m } = useSuspenseQuery(metricsQuery('all'))
  const maxPath = Math.max(1, ...m.guardByPath.map((p) => p.count))

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader title="Activity" />

      <div className="mb-6">
        <ConsultRateHero
          rate={m.consultRate}
          sessionsTotal={m.sessionsTotal}
          sessionsWithGuard={m.sessionsWithGuard}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <StatCard
          label="Always-on injections"
          value={m.alwaysOnInjections}
          sub="context calls"
        />
        <StatCard
          label="Guard calls"
          value={m.guardCalls}
          sub={`${m.guardHits} hit${m.guardHits !== 1 ? 's' : ''}`}
        />
      </div>

      {m.conflicts > 0 && (
        <div className="mb-6">
          <StatCard
            label="Conflicts flagged"
            value={m.conflicts}
            sub="guard returned a conflict decision"
          />
        </div>
      )}

      {m.guardByPath.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-surface px-6 py-5">
          <h2 className="mb-4 text-sm font-medium text-fg">Guard calls by path</h2>
          <MiniBarChart items={m.guardByPath} max={maxPath} />
        </div>
      )}

      {m.mostServed.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-5">
          <h2 className="mb-4 text-sm font-medium text-fg">Most served decisions</h2>
          <DecisionRankList items={m.mostServed} />
        </div>
      )}
    </div>
  )
}
