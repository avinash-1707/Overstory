import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SessionTimeline } from '../components/SessionTimeline'
import { EmptyState } from '../components/ui'
import { timelineQuery } from '../lib/queries'

export const Route = createFileRoute('/dashboard/sessions/$sessionId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(timelineQuery(params.sessionId)),
  component: SessionTimelinePage,
})

function SessionTimelinePage() {
  const { sessionId } = Route.useParams()
  const { data: events } = useSuspenseQuery(timelineQuery(sessionId))

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link
        to="/dashboard/sessions"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
      >
        <span aria-hidden="true">←</span>
        <span>Sessions</span>
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="font-display text-2xl tracking-tight text-fg">Session</h1>
        <p className="mt-0.5 font-mono text-xs text-fg-subtle">{sessionId}</p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No calls recorded"
          description="This session has no timeline events."
        />
      ) : (
        <SessionTimeline events={events} />
      )}
    </div>
  )
}
