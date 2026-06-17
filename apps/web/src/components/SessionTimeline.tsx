import { DecisionDetail } from './DecisionDetail'
import { Tag } from './ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServedDecisionView = {
  id: string
  present: boolean
  superseded: boolean
  supersededById: string | null
  title: string | null
  statement: string | null
  why: string | null
  where: { filePath: string; symbol: string | null }[]
  status: 'proposed' | 'decided' | 'needs_reconfirmation' | 'superseded' | null
  stale: boolean
}

type TimelineEvent = {
  id: string
  tool: 'context' | 'guard' | 'check' | 'decision' | 'search'
  query: {
    files?: string[]
    summary?: string
    decisionId?: string
    query?: string
  }
  createdAt: Date
  latencyMs: number
  served: ServedDecisionView[]
  conflicts: ServedDecisionView[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** CSS custom property for each tool's dot color */
const DOT_COLOR: Record<TimelineEvent['tool'], string> = {
  context: 'var(--fg-subtle)',
  guard: 'var(--accent)',
  decision: 'var(--fg)',
  check: 'var(--danger)',
  search: 'var(--fg-subtle)',
}

/** Text color class for the summary tool label */
const TOOL_TEXT_CLASS: Record<TimelineEvent['tool'], string> = {
  context: 'text-fg-subtle',
  guard: 'text-accent',
  decision: 'text-fg',
  check: 'text-danger',
  search: 'text-fg-subtle',
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ---------------------------------------------------------------------------
// QueryPreview — compact inline query hint shown in the summary row
// ---------------------------------------------------------------------------

function QueryPreview({ query }: { query: TimelineEvent['query'] }) {
  if (query.files && query.files.length > 0) {
    const shown = query.files.slice(0, 2)
    const extra = query.files.length - 2
    return (
      <span className="flex flex-wrap items-center gap-1">
        {shown.map((f) => (
          <Tag key={f}>{f}</Tag>
        ))}
        {extra > 0 && (
          <span className="text-2xs text-fg-subtle">+{extra} more</span>
        )}
      </span>
    )
  }
  if (query.decisionId) {
    return <Tag>{query.decisionId}</Tag>
  }
  if (query.summary) {
    return (
      <span className="text-xs text-fg-muted truncate max-w-[320px]">{query.summary}</span>
    )
  }
  if (query.query) {
    return (
      <span className="text-xs text-fg-muted truncate max-w-[320px]">{query.query}</span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// TimelineItem
// ---------------------------------------------------------------------------

function TimelineItem({
  event,
  index,
}: {
  event: TimelineEvent
  index: number
}) {
  const dotColor = DOT_COLOR[event.tool]
  const toolTextClass = TOOL_TEXT_CLASS[event.tool]
  const hasContent = event.served.length > 0 || event.conflicts.length > 0

  return (
    <li className="relative mb-1">
      {/* Timeline dot — positioned against the parent's left border */}
      <span
        className="absolute -left-[5px] top-[17px] h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: dotColor,
          animation: `dot-pop 240ms var(--ease-out) ${index * 40}ms both`,
        }}
        aria-hidden="true"
      />

      {hasContent ? (
        <details className="group">
          {/* Summary row */}
          <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-raised">
            {/* Chevron */}
            <span className="chevron shrink-0 text-fg-subtle" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M3 2l4 3-4 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            {/* Tool label */}
            <span className={`font-mono text-xs font-medium ${toolTextClass}`}>
              {event.tool}
            </span>

            {/* Query preview */}
            <span className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
              <QueryPreview query={event.query} />
            </span>

            {/* Meta: time + latency */}
            <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-2xs text-fg-subtle">
              <span>{formatTime(new Date(event.createdAt))}</span>
              <span className="text-fg-subtle opacity-40">·</span>
              <span>{event.latencyMs}ms</span>
            </span>
          </summary>

          {/* Expanded content */}
          <div className="ml-3 mt-1.5 flex flex-col gap-2 pb-3 pl-4 border-l border-border">
            {/* Served decisions */}
            {event.served.length > 0 && (
              <div className="flex flex-col gap-2">
                {event.served.map((d) => (
                  <DecisionDetail key={d.id} decision={d} />
                ))}
              </div>
            )}

            {/* Conflicts section */}
            {event.conflicts.length > 0 && (
              <div className="mt-1">
                <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-danger">
                  conflicts
                </span>
                <div className="flex flex-col gap-2">
                  {event.conflicts.map((d) => (
                    <DecisionDetail key={d.id} decision={d} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      ) : (
        /* No expandable content: flat row */
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className={`font-mono text-xs font-medium ${toolTextClass}`}>
            {event.tool}
          </span>

          <span className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            <QueryPreview query={event.query} />
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-2xs text-fg-subtle">
            <span>{formatTime(new Date(event.createdAt))}</span>
            <span className="opacity-40">·</span>
            <span>{event.latencyMs}ms</span>
          </span>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// SessionTimeline
// ---------------------------------------------------------------------------

interface SessionTimelineProps {
  events: TimelineEvent[]
}

export function SessionTimeline({ events }: SessionTimelineProps) {
  return (
    <ol
      className="relative ml-3 border-l-2 border-border pl-6"
      aria-label="Session timeline"
    >
      {events.map((event, i) => (
        <TimelineItem key={event.id} event={event} index={i} />
      ))}
    </ol>
  )
}
