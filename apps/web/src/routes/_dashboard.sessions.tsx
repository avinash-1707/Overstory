import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import { sessionsQuery } from '../lib/queries'

export const Route = createFileRoute('/_dashboard/sessions')({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery('all')),
  component: SessionsPage,
})

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function truncateId(id: string, len = 20): string {
  return id.length > len ? id.slice(0, len) + '...' : id
}

function SessionsPage() {
  const { data: sessions } = useSuspenseQuery(sessionsQuery('all'))

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader title="Sessions" />

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Sessions appear once an agent consults Overstory."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="divide-y divide-border">
            {sessions.map((s, i) => (
              <Link
                key={s.sessionId}
                to="/sessions/$sessionId"
                params={{ sessionId: s.sessionId }}
                className="session-row flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-raised"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Relative time */}
                <span className="w-20 shrink-0 text-2xs text-fg-subtle">
                  {formatRelative(new Date(s.lastAt))}
                </span>

                {/* Session ID */}
                <span className="flex-1 font-mono text-xs text-fg-muted">
                  {truncateId(s.sessionId)}
                </span>

                {/* Stat group: calls */}
                <span className="hidden shrink-0 flex-col items-end sm:flex">
                  <span className="font-mono text-xs text-fg">{s.callCount}</span>
                  <span className="text-2xs text-fg-subtle">calls</span>
                </span>

                {/* Stat group: served */}
                <span className="hidden shrink-0 flex-col items-end md:flex">
                  <span className="font-mono text-xs text-fg">{s.servedCount}</span>
                  <span className="text-2xs text-fg-subtle">served</span>
                </span>

                {/* Guard-fired badge */}
                {s.guardFired && (
                  <Badge variant="danger">guard fired</Badge>
                )}

                {/* Arrow */}
                <span className="text-sm text-fg-subtle" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
