import { createFileRoute } from '@tanstack/react-router'
import { metricsFn } from '../server/functions'

export const Route = createFileRoute('/_dashboard/activity')({
  loader: () => metricsFn({ data: { window: 'all' } }),
  component: ActivityPage,
})

function ActivityPage() {
  const m = Route.useLoaderData()
  const pct = Math.round(m.consultRate * 100)
  const maxPath = Math.max(1, ...m.guardByPath.map((p) => p.count))

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="mb-6 font-display text-3xl tracking-tight">Activity</h1>

      {/* Consult-rate headline (Risk 4) */}
      <div className="mb-6 rounded-lg border border-border bg-surface px-8 py-10 text-center">
        <div className="font-display text-5xl text-fg">{pct}%</div>
        <div className="mt-2 text-2xs uppercase tracking-[0.15em] text-fg-muted">Consult rate</div>
        <p className="mx-auto mt-2 max-w-md text-2xs text-fg-subtle">
          Sessions where the agent ran a guard check, out of {m.sessionsTotal}. This counts
          files the agent named, not the full diff, so it is a rough upper bound until
          PR-level data lands.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Stat label="Always-on injections" value={m.alwaysOnInjections} sub="context calls" />
        <Stat label="Guard calls" value={m.guardCalls} sub={`${m.guardHits} returned a decision`} />
      </div>

      {m.guardByPath.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-surface px-6 py-5">
          <h2 className="mb-4 text-sm text-fg">Guard calls by path</h2>
          <ul className="space-y-2">
            {m.guardByPath.map((p) => (
              <li key={p.filePath} className="flex items-center gap-3">
                <span className="w-64 shrink-0 truncate font-mono text-xs text-fg-muted">
                  {p.filePath}
                </span>
                <span
                  className="h-2 rounded-sm border border-accent bg-accent-muted"
                  style={{ width: `${(p.count / maxPath) * 100}%` }}
                />
                <span className="font-mono text-xs text-fg-subtle">{p.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.mostServed.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-5">
          <h2 className="mb-4 text-sm text-fg">Most-served decisions</h2>
          <ol className="space-y-2">
            {m.mostServed.map((d, i) => (
              <li key={d.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-5 shrink-0 font-mono text-xs text-fg-subtle">{i + 1}.</span>
                <span className="flex-1 text-fg">
                  {d.present ? d.title : <span className="text-fg-subtle">deleted decision</span>}
                </span>
                <span className="font-mono text-xs text-fg-muted">×{d.count}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-5">
      <div className="text-2xs uppercase tracking-[0.12em] text-fg-muted">{label}</div>
      <div className="mt-2 font-display text-3xl text-fg">{value}</div>
      <div className="mt-1 text-xs text-fg-subtle">{sub}</div>
    </div>
  )
}
