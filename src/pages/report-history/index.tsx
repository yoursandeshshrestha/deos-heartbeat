import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 10

const overviewCardClass =
  'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

type ReportRow = {
  id: string
  report_type: 'daily' | 'weekly'
  filename: string
  period_label: string
  created_at: string
  trusts: { name: string } | { name: string }[] | null
}

function trustName(row: ReportRow) {
  const trust = row.trusts
  if (Array.isArray(trust)) return trust[0]?.name ?? '—'
  return trust?.name ?? '—'
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

export function ReportHistoryPage() {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const from = (page - 1) * PAGE_SIZE
      const { data, error: queryError, count } = await supabase
        .from('generated_reports')
        .select('id, report_type, filename, period_label, created_at, trusts(name)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setRows([])
        setTotal(0)
      } else {
        setRows((data ?? []) as ReportRow[])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = (page - 1) * PAGE_SIZE + rows.length

  async function openReport(row: ReportRow) {
    setOpeningId(row.id)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Not signed in')

      const response = await fetch(`/api/generated-reports?id=${encodeURIComponent(row.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not open report')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : 'Could not open report')
    } finally {
      setOpeningId(null)
    }
  }

  if (loading && rows.length === 0 && !error) {
    return <PageLoading />
  }

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header">
        <p className="text-sm text-muted-foreground">
          Daily and weekly performance PDFs, newest first. A copy is kept each time a
          report is generated.
        </p>
      </div>

      <div className="content-section__content pt-6">
        {error && rows.length === 0 ? (
          <PageEmptyState title="Could not load reports" description={error} />
        ) : total === 0 ? (
          <PageEmptyState
            title="No reports stored yet"
            description="Daily and weekly PDFs appear here after they are generated and sent."
          />
        ) : (
          <section className={overviewCardClass}>
            <div className={overviewHeaderClass}>
              <span>Generated reports</span>
              <span className="text-sm tabular-nums">{total}</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-180 px-4 pb-1 pt-3.5">
                <header className="grid grid-cols-[150px_minmax(160px,1.2fr)_88px_minmax(160px,1fr)_72px] gap-3 text-sm font-medium text-muted-foreground">
                  <span>Generated</span>
                  <span>Trust</span>
                  <span>Type</span>
                  <span>Period</span>
                  <span className="sr-only">Open</span>
                </header>
                <div className="-mx-4 mt-1 divide-y divide-border">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[150px_minmax(160px,1.2fr)_88px_minmax(160px,1fr)_72px] items-center gap-3 px-4 py-3 text-sm"
                    >
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {formatWhen(row.created_at)}
                      </span>
                      <span className="truncate font-medium">{trustName(row)}</span>
                      <span>
                        <Badge variant={row.report_type === 'daily' ? 'outline' : 'secondary'}>
                          {row.report_type}
                        </Badge>
                      </span>
                      <span className="truncate text-muted-foreground">
                        {row.period_label || '—'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={openingId === row.id}
                        onClick={() => void openReport(row)}
                      >
                        {openingId === row.id ? <Spinner size="sm" /> : 'Open'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-sm tabular-nums text-muted-foreground">
                {rangeStart}–{rangeEnd} of {total}
              </p>
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#report-history"
                      text="Previous"
                      className={page <= 1 ? 'pointer-events-none opacity-40' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page > 1) setPage(page - 1)
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-sm tabular-nums text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#report-history"
                      text="Next"
                      className={page >= totalPages ? 'pointer-events-none opacity-40' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page < totalPages) setPage(page + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
            {error ? (
              <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
