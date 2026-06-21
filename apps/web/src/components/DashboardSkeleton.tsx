// Skeleton rendered by the router's defaultPendingComponent while dashboard route data loads.
// Mirrors the sessions-list layout exactly: same container, PageHeader slot, card with divided rows.

const ROW_COUNT = 6

// Width classes for the mono id bar — varied so rows don't look stamped.
const ID_WIDTHS = ['w-48', 'w-56', 'w-40', 'w-52', 'w-44', 'w-36'] as const

// Width classes for the timestamp bar — slight variation keeps it natural.
const TS_WIDTHS = ['w-14', 'w-16', 'w-12', 'w-16', 'w-14', 'w-12'] as const

function SkeletonBlock({
  className = '',
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <span
      className={`block rounded-sm bg-raised animate-pulse motion-reduce:animate-none ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-8" aria-busy="true" aria-label="Loading">
      {/* PageHeader placeholder — matches mb-8 wrapper + font-display text-3xl height */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-8 w-36" delay={0} />
            <SkeletonBlock className="h-3 w-24" delay={40} />
          </div>
        </div>
      </div>

      {/* Card — mirrors rounded-lg border border-border bg-surface with divide-y */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="divide-y divide-border">
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-3.5"
              style={{ opacity: 1 - i * 0.06 }}
            >
              {/* Timestamp column — w-20 shrink-0 */}
              <SkeletonBlock
                className={`h-3 ${TS_WIDTHS[i]} shrink-0`}
                delay={i * 30}
              />

              {/* Mono id column — flex-1 */}
              <SkeletonBlock
                className={`h-3 ${ID_WIDTHS[i]}`}
                delay={i * 30 + 15}
              />

              {/* Right side: call count stack (hidden on small) */}
              <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                <SkeletonBlock className="h-3 w-5" delay={i * 30 + 25} />
                <SkeletonBlock className="h-2 w-7" delay={i * 30 + 35} />
              </div>

              {/* Right side: served count stack (hidden on medium and below) */}
              <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
                <SkeletonBlock className="h-3 w-5" delay={i * 30 + 30} />
                <SkeletonBlock className="h-2 w-8" delay={i * 30 + 40} />
              </div>

              {/* Chevron placeholder */}
              <SkeletonBlock className="h-3 w-2 shrink-0" delay={i * 30 + 45} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
