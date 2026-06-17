import { createFileRoute, Link } from '@tanstack/react-router'
import { sessionsFn } from '../server/functions'

export const Route = createFileRoute('/_dashboard/sessions')({
  loader: () => sessionsFn({ data: { window: 'all' } }),
  component: SessionsPage,
})

function SessionsPage() {
  const sessions = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="mb-6 font-display text-3xl tracking-tight">Sessions</h1>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-6 py-16 text-center">
          <p className="text-fg">No sessions yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            Sessions appear once an agent consults Overstory.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: s.sessionId }}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-raised"
              >
                <span className="w-28 shrink-0 text-xs text-fg-subtle">
                  {new Date(s.lastAt).toLocaleString()}
                </span>
                <span className="flex-1 truncate font-mono text-xs text-fg-muted">
                  {s.sessionId}
                </span>
                <span className="font-mono text-xs text-fg-muted">{s.callCount} calls</span>
                {s.guardFired && (
                  <span className="rounded-sm bg-danger-muted px-1.5 py-0.5 text-2xs text-danger">
                    guard fired
                  </span>
                )}
                <span className="font-mono text-xs text-fg-muted">{s.servedCount} served</span>
                <span className="text-fg-subtle">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
