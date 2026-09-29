import { useEffect, useRef } from 'react'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useAuditLog } from '@/hooks/useAuditLog'

const overviewCardClass =
  'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

function actionBadge(action: string) {
  if (action === 'insert') return <Badge variant="success">insert</Badge>
  if (action === 'update') return <Badge variant="warning">update</Badge>
  if (action === 'delete') return <Badge variant="destructive">delete</Badge>
  return <Badge variant="outline">{action}</Badge>
}

function summarize(entry: {
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}) {
  const after = entry.after
  const before = entry.before
  if (entry.action === 'insert' && after) {
    return String(after.name ?? after.display_name ?? after.email ?? after.slug ?? 'created')
  }
  if (entry.action === 'delete' && before) {
    return String(before.name ?? before.display_name ?? before.email ?? before.slug ?? 'deleted')
  }
  if (before && after) {
    const keys = Object.keys(after).filter((key) => {
      return JSON.stringify(before[key]) !== JSON.stringify(after[key])
    })
    if (!keys.length) return 'no field changes'
    return keys
      .slice(0, 4)
      .map((key) => `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`)
      .join(', ')
  }
  return '—'
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function AuditPage() {
  const { entries, loading, loadingMore, hasMore, error, loadMore } = useAuditLog(40)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore, entries.length])

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header">
        <p className="text-sm text-muted-foreground">
          Immutable log of changes to trusts, vans, and recipients in Heartbeat.
        </p>
      </div>

      <div className="content-section__content pt-6">
        {error && !entries.length ? (
          <PageEmptyState title="Could not load audit log" description={error} />
        ) : !entries.length ? (
          <PageEmptyState
            title="No audit entries yet"
            description="Changes to trusts, vans, and recipients will appear here automatically."
          />
        ) : (
          <section className={overviewCardClass}>
            <div className={overviewHeaderClass}>
              <span>Recent changes</span>
              <span className="text-sm tabular-nums">
                {entries.length}
                {hasMore ? '+' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px] px-4 pb-1 pt-3.5">
                <header className="grid grid-cols-[140px_88px_minmax(120px,0.9fr)_minmax(200px,1.6fr)] gap-3 text-sm font-medium text-muted-foreground">
                  <span>When</span>
                  <span>Action</span>
                  <span>Entity</span>
                  <span>Summary</span>
                </header>
                <div className="-mx-4 mt-1 divide-y divide-border">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[140px_88px_minmax(120px,0.9fr)_minmax(200px,1.6fr)] items-start gap-3 px-4 py-3 text-sm"
                    >
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {formatWhen(entry.at)}
                      </span>
                      <span>{actionBadge(entry.action)}</span>
                      <span className="truncate font-mono text-xs">
                        {entry.entity}
                        {entry.entity_id ? (
                          <span className="text-muted-foreground">
                            {' '}
                            · {entry.entity_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="text-sm leading-snug text-muted-foreground"
                        title={summarize(entry)}
                      >
                        {summarize(entry)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div ref={sentinelRef} className="flex items-center justify-center px-4 py-4">
              {loadingMore ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : hasMore ? (
                <span className="text-xs text-muted-foreground">Scroll for more</span>
              ) : (
                <span className="text-xs text-muted-foreground">End of log</span>
              )}
            </div>
            {error ? (
              <p className="border-t border-border px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
