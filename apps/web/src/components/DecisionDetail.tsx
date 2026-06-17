import { Badge, Tag } from './ui'

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

interface DecisionDetailProps {
  decision: ServedDecisionView
}

export function DecisionDetail({ decision: d }: DecisionDetailProps) {
  if (!d.present) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-3">
        <span className="text-xs italic text-fg-subtle">
          This decision no longer exists ({d.id.slice(0, 8)})
        </span>
      </div>
    )
  }

  return (
    <div className="timeline-card rounded-md border border-border bg-surface px-4 py-3">
      {/* Header row: title + badges */}
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex-1 text-sm text-fg">{d.title}</span>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {d.stale && <Badge variant="warning">needs reconfirmation</Badge>}
          {d.superseded && <Badge variant="danger">superseded</Badge>}
          {d.status === 'proposed' && !d.superseded && !d.stale && (
            <Badge variant="muted">proposed</Badge>
          )}
        </div>
      </div>

      {/* Why */}
      {d.why && (
        <p className="mt-2 text-xs leading-relaxed text-fg-muted line-clamp-4">{d.why}</p>
      )}

      {/* File pointers */}
      {d.where.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {d.where.map((w, i) => (
            <Tag key={i}>{w.symbol ? `${w.filePath}#${w.symbol}` : w.filePath}</Tag>
          ))}
        </div>
      )}
    </div>
  )
}
