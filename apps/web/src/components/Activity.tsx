// Design: Editorial / Archival. Matches the dark token palette in ui.tsx.

interface ConsultRateHeroProps {
  rate: number
  sessionsTotal: number
  sessionsWithGuard: number
}

export function ConsultRateHero({ rate, sessionsTotal, sessionsWithGuard }: ConsultRateHeroProps) {
  const pct = Math.round(rate * 100)
  const conicBg = `conic-gradient(from -90deg, var(--accent) 0% ${pct}%, var(--raised) ${pct}% 100%)`

  return (
    <div className="rounded-lg border border-border bg-surface px-8 py-12 text-center">
      <div
        className="relative mx-auto mb-6 h-20 w-20 rounded-full"
        style={{ background: conicBg }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-surface" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs font-medium text-fg">{pct}%</span>
        </div>
      </div>

      <div className="font-display text-5xl text-fg">{pct}%</div>

      <div className="mt-2 text-2xs uppercase tracking-[0.15em] text-fg-muted">Consult Rate</div>

      <p className="mx-auto mt-3 max-w-md text-2xs text-fg-subtle">
        Sessions where the agent ran a guard check, out of {sessionsTotal}. This counts files the
        agent named, not the full diff, so it is a rough upper bound until PR-level data lands.
      </p>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent = false }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-5">
      <div className="text-2xs uppercase tracking-[0.12em] text-fg-muted">{label}</div>
      <div className={`mt-2 font-display text-3xl ${accent ? 'text-accent' : 'text-fg'}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-fg-subtle">{sub}</div>}
    </div>
  )
}

interface MiniBarChartProps {
  items: { filePath: string; count: number }[]
  max: number
}

export function MiniBarChart({ items, max }: MiniBarChartProps) {
  return (
    <ul className="space-y-2.5">
      {items.map((p) => (
        <li key={p.filePath} className="flex items-center gap-3">
          <span
            className="w-52 shrink-0 truncate font-mono text-xs text-fg-muted"
            title={p.filePath}
          >
            {p.filePath}
          </span>
          <div className="flex-1 overflow-hidden rounded-full bg-raised" style={{ height: '6px' }}>
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.max(2, (p.count / max) * 100)}%`,
                opacity: 0.7,
              }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-subtle">
            {p.count}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface DecisionRankListProps {
  items: { id: string; title: string | null; present: boolean; count: number }[]
}

export function DecisionRankList({ items }: DecisionRankListProps) {
  return (
    <ol className="space-y-2.5">
      {items.map((d, i) => (
        <li key={d.id} className="flex items-baseline gap-3">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-accent">{i + 1}</span>
          <span className="flex-1 text-sm text-fg">
            {d.present ? (
              d.title ?? <span className="text-fg-subtle">Untitled</span>
            ) : (
              <span className="italic text-fg-subtle">deleted decision</span>
            )}
          </span>
          <span className="shrink-0 font-mono text-xs text-fg-muted">x{d.count}</span>
        </li>
      ))}
    </ol>
  )
}
