import { createFileRoute, Link } from '@tanstack/react-router'
import { timelineFn } from '../server/functions'

export const Route = createFileRoute('/_dashboard/sessions/$sessionId')({
  loader: ({ params }) => timelineFn({ data: { sessionId: params.sessionId } }),
  component: SessionTimelinePage,
})

const DOT: Record<string, string> = {
  context: 'bg-fg-subtle',
  guard: 'bg-accent',
  decision: 'bg-fg',
  check: 'bg-danger',
  search: 'bg-fg-subtle',
}

function SessionTimelinePage() {
  const events = Route.useLoaderData()
  const { sessionId } = Route.useParams()

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link to="/sessions" className="text-sm text-fg-muted hover:text-fg">
        ← Sessions
      </Link>
      <h1 className="mt-3 mb-1 font-display text-2xl tracking-tight">Session</h1>
      <p className="mb-8 font-mono text-xs text-fg-subtle">{sessionId}</p>

      {events.length === 0 ? (
        <p className="text-sm text-fg-muted">No calls recorded in this session.</p>
      ) : (
        <ol className="relative ml-2 border-l border-border pl-6">
          {events.map((e) => (
            <li key={e.id} className="mb-6">
              <span
                className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[e.tool] ?? 'bg-fg-subtle'}`}
              />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-fg">
                  {e.tool}
                  {e.query.files?.length ? (
                    <span className="ml-2 font-mono text-xs text-fg-muted">
                      {e.query.files.join(', ')}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-2xs text-fg-subtle">
                  {new Date(e.createdAt).toLocaleTimeString()} · {e.latencyMs}ms
                </span>
              </div>

              {e.served.map((d) => (
                <div
                  key={d.id}
                  className="mt-2 rounded-md border border-border bg-surface px-4 py-3"
                >
                  {d.present ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-fg">{d.title}</span>
                        {d.stale && (
                          <span className="rounded-sm bg-accent-muted px-1.5 py-0.5 text-2xs text-accent">
                            needs reconfirmation
                          </span>
                        )}
                        {d.superseded && (
                          <span className="rounded-sm bg-danger-muted px-1.5 py-0.5 text-2xs text-danger">
                            superseded
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">{d.why}</p>
                      {d.where.length > 0 && (
                        <p className="mt-1 font-mono text-2xs text-fg-subtle">
                          {d.where.map((w) => w.filePath).join(', ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-fg-subtle">
                      This decision no longer exists ({d.id})
                    </span>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
