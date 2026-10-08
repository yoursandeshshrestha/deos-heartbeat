import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useSWR from 'swr'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { DateRangePicker, type DateSpan } from '@/components/ui/date-range-picker'
import { Switch } from '@/components/ui/switch'
import type { Figures, InsightsPayload, TicketsPayload } from '@/lib/addon-types'
import { useAuth } from '@/lib/auth'
import { useReportConfig, type VanPatch } from '@/hooks/useReportConfig'
import type { Van } from '@/lib/heartbeat-types'
import type { FleetPayload, FleetStatus, FleetVan } from '@/lib/fleet-types'
import { serverFetch } from '@/lib/serverApi'
import { cn } from '@/lib/utils'
import { vanPath } from '@/lib/van-path'

const STATUS_LABEL: Record<FleetStatus, string> = {
  green: 'Online',
  amber: 'Degraded',
  grey: 'Not scheduled',
  red: 'Offline',
}

const STATUS_ORDER: FleetStatus[] = ['green', 'amber', 'grey', 'red']

const STATUS_DOT: Record<FleetStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-orange-500',
  grey: 'bg-zinc-400',
  red: 'bg-red-500',
}

const STATUS_PILL: Record<FleetStatus, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  grey: 'bg-zinc-100 text-zinc-600',
  red: 'bg-red-50 text-red-700',
}

const overviewCardClass = 'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json()
}

function shortName(van: FleetVan) {
  const parts = van.instance.split('.')
  if (parts.length > 1) return parts.slice(1).join('.')
  return van.display_name
}

function londonToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatWhen(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function VansPage() {
  const { role } = useAuth()
  const canWrite = role === 'admin'
  const today = londonToday()
  const [span, setSpan] = useState<DateSpan>({ from: today, to: today })
  const isToday = span.from === today && span.to === today
  const { trusts, unassigned, loading: configLoading, updateVan } = useReportConfig()
  const { data, error, isLoading } = useSWR<FleetPayload>('/api/fleet', (url: string) => fetcher<FleetPayload>(url), {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
  })
  const { data: tickets, error: ticketsError } = useSWR<TicketsPayload>('/api/tickets?status=all', (url: string) =>
    fetcher<TicketsPayload>(url),
  )
  const {
    data: history,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR<InsightsPayload>(
    isToday ? null : `/api/insights?from=${span.from}&to=${span.to}`,
    (url: string) => fetcher<InsightsPayload>(url),
    { keepPreviousData: true },
  )

  if ((isLoading && !data) || (configLoading && trusts.length === 0 && unassigned.length === 0)) return <PageLoading />
  if (error && !data) {
    return (
      <div className="p-6">
        <PageEmptyState title="Vans unavailable" description={error.message} />
      </div>
    )
  }
  if (!data) return null

  const configured = new Map<string, Van>()
  for (const trust of trusts) {
    for (const van of trust.vans) configured.set(van.instance, van)
  }
  for (const van of unassigned) configured.set(van.instance, van)

  const rows = data.vans
    .filter((van) => configured.get(van.instance)?.status !== 'removed')
    .slice()
    .sort((a, b) => shortName(a).localeCompare(shortName(b)))

  const paused = rows.filter((van) => isPaused(van, configured.get(van.instance) ?? null))
  const active = rows.filter((van) => !paused.includes(van))
  const up = rows.filter((van) => van.status !== 'red').length
  const patients = active.reduce((sum, van) => sum + (van.patients_today ?? 0), 0)
  const scheduled = active.reduce((sum, van) => sum + (van.worklist_today ?? 0), 0)
  const failed = active.reduce((sum, van) => sum + (van.sync_failed ?? 0), 0)
  const speeds = active.map((van) => van.sync_speed).filter((value): value is number => value != null && Number.isFinite(value))
  const avgSpeed = speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : null
  const openTickets = (tickets?.tickets ?? []).filter((ticket) => ticket.status === 'open' || ticket.status === 'pending')
  const lastClosed = (tickets?.tickets ?? [])
    .filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed')
    .map((ticket) => ticket.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  const counts = countStatuses(rows)
  const historyReady = !isToday && history?.from === span.from && history?.to === span.to
  const historyByVan = new Map((historyReady ? history.vans : []).map((van) => [van.instance, van.figures]))
  const period = historyReady ? periodTotals(rows, historyByVan) : null

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__content space-y-6">
      <section aria-label="Van status" className={overviewCardClass}>
        <div className={overviewHeaderClass}>
          <span>Overview</span>
        </div>
        <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
          <StatCell
            title="Online"
            value={`${up} / ${rows.length}`}
            detail={
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {STATUS_ORDER.map((status) =>
                  counts[status] ? (
                    <span key={status} className="inline-flex items-center gap-1.5">
                      <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[status])} />
                      <span>
                        {STATUS_LABEL[status]}{' '}
                        <span className="tabular-nums text-foreground">{counts[status]}</span>
                      </span>
                    </span>
                  ) : null,
                )}
                {paused.length ? (
                  <span>
                    Paused <span className="tabular-nums text-foreground">{paused.length}</span>
                  </span>
                ) : null}
              </span>
            }
          />
          <StatCell
            title="Screened today"
            value={patients.toLocaleString('en-GB')}
            detail={
              <>
                of{' '}
                <span className="tabular-nums text-foreground">
                  {scheduled.toLocaleString('en-GB')}
                </span>{' '}
                scheduled
              </>
            }
          />
          <StatCell
            title="Upload to PACS"
            value={avgSpeed == null ? '—' : avgSpeed.toFixed(2)}
            detail={
              <>
                MB/s average
                <span className="mx-2 text-border">·</span>
                Failed <span className="tabular-nums text-foreground">{failed}</span>
              </>
            }
          />
          <StatCell
            title="Open tickets"
            value={tickets ? String(openTickets.length) : '—'}
            detail={
              ticketsError && !tickets
                ? 'Unavailable'
                : lastClosed
                  ? `Last closed ${formatWhen(lastClosed)}`
                  : 'None closed yet'
            }
          />
        </div>
      </section>

      <section className={overviewCardClass}>
        <div className={overviewHeaderClass}>
          <span>Vans</span>
          <DateRangePicker from={span.from} to={span.to} onChange={setSpan} />
        </div>
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {isToday
            ? 'Switch a van off to leave it out of that report.'
            : historyError && !historyReady
              ? 'Those dates are unavailable right now.'
              : historyLoading && !historyReady
                ? 'Loading this range.'
                : period
                  ? `${period.patients.toLocaleString('en-GB')} screened of ${period.scheduled.toLocaleString('en-GB')} scheduled${period.speed == null ? '' : ` · ${period.speed.toFixed(2)} MB/s average`} · ${period.failed} failed`
                  : 'Switch a van off to leave it out of that report.'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th>Van</th>
                <th>Status</th>
                <th>{isToday ? 'Screened today' : 'Screened'}</th>
                <th>Upload</th>
                <th>Failed</th>
                <th>Daily</th>
                <th>Weekly</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((van) => (
                  <VanRow
                    key={van.instance}
                    van={van}
                    record={configured.get(van.instance) ?? null}
                    canWrite={canWrite}
                    onUpdateVan={updateVan}
                    period={isToday ? undefined : historyByVan.get(van.instance) ?? null}
                    periodPending={!isToday && !historyReady}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-muted-foreground">
                    No vans in the fleet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  )
}

function StatCell({ title, value, detail }: { title: string; value: string; detail: ReactNode }) {
  return (
    <div className="relative flex min-h-0 w-full flex-col gap-1.5 overflow-hidden bg-white px-4 py-3.5 text-left dark:bg-card">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="text-sm leading-snug text-muted-foreground">{detail}</div>
    </div>
  )
}

function periodTotals(vans: FleetVan[], figures: Map<string, Figures>) {
  let patients = 0
  let scheduled = 0
  let failed = 0
  let speedSum = 0
  let speedCount = 0
  for (const van of vans) {
    const row = figures.get(van.instance)
    if (!row) continue
    patients += row.patients
    scheduled += row.worklist
    failed += row.syncFailed
    if (row.syncSpeed != null && Number.isFinite(row.syncSpeed)) {
      speedSum += row.syncSpeed
      speedCount += 1
    }
  }
  return {
    patients,
    scheduled,
    failed,
    speed: speedCount ? speedSum / speedCount : null,
  }
}

function countStatuses(vans: FleetVan[]) {
  return vans.reduce(
    (acc, van) => {
      acc[van.status] += 1
      return acc
    },
    { red: 0, amber: 0, grey: 0, green: 0 } as Record<FleetStatus, number>,
  )
}

function isPaused(van: FleetVan, record: Van | null) {
  if (record) return record.status === 'paused'
  return van.van_status === 'paused'
}

function VanRow({
  van,
  record,
  canWrite,
  onUpdateVan,
  period,
  periodPending,
}: {
  van: FleetVan
  record: Van | null
  canWrite: boolean
  onUpdateVan: (id: string, patch: VanPatch, label: string) => Promise<boolean>
  period?: Figures | null
  periodPending?: boolean
}) {
  const paused = isPaused(van, record)
  const screening = period
    ? screeningFromCounts(period.patients, period.worklist)
    : screeningOf(van, paused)
  const speed = period ? period.syncSpeed : paused || van.sync_speed == null ? null : van.sync_speed
  const failed = period ? period.syncFailed : paused ? 0 : (van.sync_failed ?? 0)

  return (
    <tr>
      <td className="py-3">
        <Link to={vanPath(van.instance)} className="min-w-0 hover:underline">
          <span className="block truncate font-medium">{shortName(van)}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">{van.instance}</span>
        </Link>
      </td>
      <td>
        {paused ? (
          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Paused</span>
        ) : (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_PILL[van.status])}>
            {STATUS_LABEL[van.status]}
          </span>
        )}
      </td>
      <td>
        {periodPending ? (
          <span className="text-muted-foreground">…</span>
        ) : period === null ? (
          <span className="text-muted-foreground">No data</span>
        ) : screening.kind === 'missing' ? (
          <span className="text-muted-foreground">—</span>
        ) : screening.kind === 'counted' ? (
          <span className="tabular-nums">{screening.label}</span>
        ) : (
          <div className="flex min-w-[180px] items-center gap-2">
            <span className={cn('shrink-0 tabular-nums', screening.kind === 'empty' && 'text-muted-foreground')}>
              {screening.label}
            </span>
            <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-blue-100">
              <span className="block h-full rounded-full bg-blue-600" style={{ width: `${screening.pct}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{screening.pct}%</span>
          </div>
        )}
      </td>
      <td className="tabular-nums whitespace-nowrap">
        {periodPending ? (
          <span className="text-muted-foreground">…</span>
        ) : speed == null ? (
          <span className="text-muted-foreground">No data</span>
        ) : (
          `${speed.toFixed(2)} MB/s`
        )}
      </td>
      <td className="tabular-nums">{periodPending ? '…' : failed}</td>
      <td>
        <Switch
          checked={Boolean(record?.daily_enabled) && !paused}
          disabled={!canWrite || !record || paused}
          onCheckedChange={(checked) => {
            if (!record) return
            void onUpdateVan(record.id, { daily_enabled: checked }, 'Daily report updated')
          }}
        />
      </td>
      <td>
        <Switch
          checked={Boolean(record?.weekly_enabled) && !paused}
          disabled={!canWrite || !record || paused}
          onCheckedChange={(checked) => {
            if (!record) return
            void onUpdateVan(record.id, { weekly_enabled: checked }, 'Weekly report updated')
          }}
        />
      </td>
    </tr>
  )
}

function screeningFromCounts(patients: number, worklist: number) {
  if (worklist > 0) {
    return {
      kind: 'progress' as const,
      label: `${patients.toLocaleString('en-GB')} of ${worklist.toLocaleString('en-GB')}`,
      pct: Math.min(100, Math.round((patients / worklist) * 100)),
    }
  }
  if (patients > 0) return { kind: 'counted' as const, label: `${patients.toLocaleString('en-GB')} screened`, pct: 0 }
  return { kind: 'empty' as const, label: 'None scheduled', pct: 0 }
}

function screeningOf(van: FleetVan, paused: boolean): { kind: 'empty' | 'progress' | 'counted' | 'missing'; label: string; pct: number } {
  if (paused) return { kind: 'empty', label: 'None scheduled', pct: 0 }
  const patients = van.patients_today
  const worklist = van.worklist_today
  if (patients == null && worklist == null) return { kind: 'missing', label: '—', pct: 0 }
  if (patients != null && worklist != null) return screeningFromCounts(patients, worklist)
  if (patients != null && patients > 0) return { kind: 'counted', label: `${patients} screened`, pct: 0 }
  return { kind: 'empty', label: 'None scheduled', pct: 0 }
}
