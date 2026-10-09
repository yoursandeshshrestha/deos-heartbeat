export { VansPage } from './list'

import 'mapbox-gl/dist/mapbox-gl.css'

import { CheckCircle, Warning } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MapView, { Layer, NavigationControl, Source, type MapRef } from 'react-map-gl/mapbox'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Button } from '@/components/ui/button'
import { DateRangePicker, type DateSpan } from '@/components/ui/date-range-picker'
import { Switch } from '@/components/ui/switch'
import { useReportConfig } from '@/hooks/useReportConfig'
import type { InsightsPayload, SupportTicket, TicketsPayload } from '@/lib/addon-types'
import { useAuth } from '@/lib/auth'
import type { FleetPayload, FleetStatus, FleetThresholds, FleetVan } from '@/lib/fleet-types'
import { isPlottableGps } from '@/lib/gps'
import { serverFetch } from '@/lib/serverApi'
import { cn } from '@/lib/utils'
import { vanPath } from '@/lib/van-path'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ''

const STATUS_LABEL: Record<FleetStatus, string> = {
  green: 'Online',
  amber: 'Degraded',
  grey: 'Not scheduled',
  red: 'Offline',
}

const STATUS_DOT: Record<FleetStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-orange-500',
  grey: 'bg-zinc-400',
  red: 'bg-red-500',
}

const STATUS_BADGE: Record<FleetStatus, string> = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  grey: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const STATUS_WORD: Record<FleetStatus, string> = {
  green: 'online',
  amber: 'amber',
  grey: 'not scheduled',
  red: 'offline',
}

const cardClass = 'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const fetcher = async (url: string): Promise<FleetPayload> => {
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Fleet API ${response.status}`)
  return response.json()
}

function progressPct(van: FleetVan) {
  const patients = van.patients_today
  const worklist = van.worklist_today
  if (
    patients == null ||
    worklist == null ||
    !Number.isFinite(patients) ||
    !Number.isFinite(worklist) ||
    worklist <= 0
  ) {
    return null
  }
  return Math.round((patients / worklist) * 100)
}

function formatMetric(value: number | string | null | undefined) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return value
}

function findVan(vans: FleetVan[], instance: string) {
  const exact = vans.find((van) => van.instance === instance)
  if (exact) return exact
  const prefixed = vans.filter((van) => instance.startsWith(van.instance))
  return prefixed.length === 1 ? prefixed[0] : undefined
}

function londonToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatStoredDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function londonHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  )
}

function ago(at: number | string | null | undefined) {
  if (at == null || at === '') return null
  const ms = typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ms)) return null
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function plainCheck(value: number | null, okValue: number, yes: string, no: string) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value === okValue ? yes : no
}

type HealthCheck = {
  label: string
  value: string
  detail: string
  ok: boolean
}

function healthChecks(van: FleetVan, thresholds: FleetThresholds): HealthCheck[] {
  const floor = van.speed_floor ?? thresholds.speed_floor_mbps
  const worklist = van.worklist_today
  const progress = progressPct(van)
  const afternoon = londonHour() >= 12 && (worklist ?? 0) > 0
  const received = ago(van.scraped_at)
  const stale =
    van.scraped_at != null &&
    Date.now() - van.scraped_at > thresholds.scrape_stale_minutes * 60_000
  const failed = van.sync_failed ?? 0
  const retry = van.sync_retry ?? 0
  const speed = van.sync_speed

  return [
    {
      label: 'Scanner responding',
      value: plainCheck(van.modality_up, 1, 'Online', 'Not responding'),
      detail: 'The scanner on this van',
      ok: van.modality_up == null || van.modality_up === 1,
    },
    {
      label: 'Hospital reachable',
      value: plainCheck(van.sync_dest_up, 0, 'Yes', 'No'),
      detail: 'Where images are sent',
      ok: van.sync_dest_up == null || van.sync_dest_up === 0,
    },
    {
      label: 'Data received',
      value: received ?? 'No recent update',
      detail: `Offline after ${thresholds.scrape_stale_minutes} min`,
      ok: (van.scrape_up == null || van.scrape_up === 1) && !stale,
    },
    {
      label: 'Failed transfers',
      value: formatMetric(van.sync_failed),
      detail: `Amber at ${thresholds.failed_queue_amber}`,
      ok: failed < thresholds.failed_queue_amber,
    },
    {
      label: 'Transfers retrying',
      value: formatMetric(van.sync_retry),
      detail: `Amber at ${thresholds.retry_queue_amber}`,
      ok: retry < thresholds.retry_queue_amber,
    },
    {
      label: 'Upload speed, 15 min average',
      value: speed == null ? '—' : `${speed.toFixed(2)} MB/s`,
      detail: `Floor ${floor} MB/s`,
      ok: speed == null || speed >= floor,
    },
    {
      label: 'Screening progress after 12:00',
      value: progress == null ? '—' : `${progress}%`,
      detail: `Amber below ${thresholds.progress_amber_pct}%`,
      ok: !afternoon || (progress != null && progress >= thresholds.progress_amber_pct),
    },
  ]
}

export function VanPage() {
  const { instance: raw = '' } = useParams()
  const instance = decodeURIComponent(raw)
  const { role } = useAuth()
  const canWrite = role === 'admin'
  const { trusts, updateVan } = useReportConfig()
  const { data, error, isLoading } = useSWR<FleetPayload>('/api/fleet', fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
  })
  const today = londonToday()
  const [span, setSpan] = useState<DateSpan>({ from: today, to: today })
  const isToday = span.from === today && span.to === today
  const {
    data: history,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR<InsightsPayload>(
    isToday ? null : `/api/insights?from=${span.from}&to=${span.to}&instance=${encodeURIComponent(instance)}`,
    async (url: string) => {
      const response = await serverFetch(url)
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      return response.json()
    },
    { keepPreviousData: true },
  )
  const { data: tickets } = useSWR<TicketsPayload>('/api/tickets?status=open', async (url: string) => {
    const response = await serverFetch(url)
    if (!response.ok) throw new Error('tickets')
    return response.json()
  })

  if (isLoading && !data) return <PageLoading />
  if (error && !data) {
    return (
      <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
        <PageEmptyState title="Van unavailable" description={error.message} />
      </div>
    )
  }

  if (!data) return null
  const van = findVan(data.vans, instance)
  if (!van) {
    return (
      <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full items-center justify-center p-4 sm:p-6 lg:p-10">
        <PageEmptyState className="h-full w-full" title="Van not found" description="This van is not in the current fleet." />
      </div>
    )
  }

  const openTickets = (tickets?.tickets ?? []).filter((ticket) => ticket.instance === van.instance)
  const checks = healthChecks(van, data.thresholds)
  const outside = checks.filter((check) => !check.ok)
  const trustName = (van.trust ?? 'unassigned').replace(/_/g, ' ')
  const received = ago(van.scraped_at)
  const patients = van.patients_today
  const scheduled = van.worklist_today
  const stillToScreen =
    patients != null && scheduled != null ? Math.max(0, Math.round(scheduled - patients)) : null
  const historyReady = !isToday && history?.from === span.from && history?.to === span.to
  const stored = historyReady ? history.current : null
  const floor = van.speed_floor ?? data.thresholds.speed_floor_mbps
  const speed = stored ? stored.syncSpeed : van.sync_speed
  const speedPct = speed == null ? 0 : Math.min(100, Math.round((speed / Math.max(floor * 4, 0.25)) * 100))
  const screenedPatients = stored ? stored.patients : patients
  const screenedScheduled = stored ? stored.worklist : scheduled
  const screenedStudies = stored ? stored.studies : van.studies_today
  const screenedRemaining =
    stored
      ? Math.max(0, stored.worklist - stored.patients)
      : stillToScreen
  const transferFailed = stored ? stored.syncFailed : van.sync_failed
  const transferComplete = stored ? stored.syncComplete : van.sync_complete
  const report = trusts
    .map((trust) => ({
      trust,
      van: trust.vans.find((item) => item.instance === van.instance),
    }))
    .find((item) => item.van)
  const primaryTicket = openTickets[0]

  return (
    <div className="content-section content-section--full space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight capitalize">{van.display_name}</h1>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[van.status])}>
              <span className={cn('size-1.5 rounded-full', STATUS_DOT[van.status])} />
              {STATUS_LABEL[van.status]}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            <span className="capitalize">{trustName}</span> trust, instance <span className="font-mono">{van.instance}</span>.
            {van.reason ? ` ${van.reason}.` : ''}
            {received ? ` Data received ${received}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker from={span.from} to={span.to} onChange={setSpan} />
        {primaryTicket ? (
          <Button asChild size="sm">
            {primaryTicket.url ? (
              <a href={primaryTicket.url} target="_blank" rel="noreferrer">
                Open ticket #{primaryTicket.id}
              </a>
            ) : (
              <Link to="/tickets">Open ticket #{primaryTicket.id}</Link>
            )}
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/tickets">Tickets</Link>
          </Button>
        )}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <section className={cn(cardClass, 'rounded-lg p-4')}>
              <h2 className="text-sm font-medium text-muted-foreground">{isToday ? 'Screening today' : 'Screening'}</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {historyLoading && !historyReady ? '…' : formatMetric(screenedPatients)}
                <span className="text-base font-medium text-muted-foreground"> of {historyLoading && !historyReady ? '…' : formatMetric(screenedScheduled)} scheduled</span>
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Patients" value={formatMetric(screenedPatients)} />
                <Row label="Studies" value={formatMetric(screenedStudies)} />
                <Row label="Still to screen" value={formatMetric(screenedRemaining)} />
              </dl>
              {!isToday ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {historyError && !historyReady
                    ? 'Those dates are unavailable right now.'
                    : historyLoading && !historyReady
                      ? 'Loading this range.'
                      : 'Stored for the dates in the calendar.'}
                </p>
              ) : null}
            </section>

            <section className={cn(cardClass, 'rounded-lg p-4')}>
              <h2 className="text-sm font-medium text-muted-foreground">
                {isToday ? 'Image transfer, last 15 min' : 'Image transfer'}
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {speed == null ? '—' : speed.toFixed(2)}
                <span className="text-base font-medium text-muted-foreground"> MB/s average</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-red-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${speedPct}%` }} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Complete" value={formatMetric(transferComplete)} />
                {isToday ? <Row label="In progress" value={formatMetric(van.sync_active)} /> : null}
                <Row label="Failed" value={formatMetric(transferFailed)} tone={transferFailed ? 'text-red-600' : undefined} />
                {isToday ? <Row label="Retrying" value={formatMetric(van.sync_retry)} /> : null}
                {stored?.uptimePct != null ? (
                  <Row label="Uptime" value={`${stored.uptimePct.toFixed(0)}%`} />
                ) : null}
              </dl>
            </section>

            <section className={cn(cardClass, 'rounded-lg p-4')}>
              <h2 className="text-sm font-medium text-muted-foreground">System health</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Scanner" value={plainCheck(van.modality_up, 1, 'Online', 'Offline')} />
                <Row label="Hospital" value={plainCheck(van.sync_dest_up, 0, 'Reachable', 'Not reachable')} />
                <Row label="Database" value={plainCheck(van.db_up, 0, 'Connected', 'Not connected')} />
                <Row label="Image store" value={plainCheck(van.orthanc_up, 0, 'Connected', 'Not connected')} />
                <Row label="Software version" value={van.version ?? '—'} />
              </dl>
            </section>
          </div>

          {historyReady && history.series.length > 1 ? (
            <section className={cn(cardClass, 'rounded-lg')}>
              <div className="px-4 py-3">
                <h2 className="text-base font-medium">Each day</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th>Day</th>
                      <th>Screened</th>
                      <th>Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.series.map((day) => (
                      <tr key={day.date}>
                        <td className="py-2">{formatStoredDay(day.date)}</td>
                        <td className="tabular-nums">{day.patients.toLocaleString('en-GB')}</td>
                        <td className="tabular-nums">{day.worklist.toLocaleString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className={cn(cardClass, 'rounded-lg')}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 className="text-base font-medium">
                Why <span className="capitalize">{van.display_name}</span> is {STATUS_WORD[van.status]}
              </h2>
            </div>
            <p className="px-4 pb-3 text-sm text-muted-foreground">
              {outside.length} of {checks.length} health checks {outside.length === 1 ? 'is' : 'are'} outside their limits. Status updates every 60 seconds.
            </p>
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
              {checks.map((check) => (
                <div key={check.label} className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                  {check.ok ? (
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" weight="fill" />
                  ) : (
                    <Warning className="mt-0.5 size-4 shrink-0 text-amber-600" weight="fill" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {check.value}
                      <span className="text-muted-foreground/80"> · {check.detail}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              {van.speed_floor == null
                ? 'This van uses the fleet default upload floor. Vans with a known slow link can have their own floor, so they don’t show amber all day.'
                : `This van has its own upload floor of ${van.speed_floor} MB/s.`}
            </p>
          </section>

          <section className={cn(cardClass, 'rounded-lg')}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <h2 className="text-base font-medium">Live readings</h2>
                <p className="text-sm text-muted-foreground">Every value below is the latest reading from this van.</p>
              </div>
              <p className="shrink-0 text-sm text-muted-foreground">{received ? `Polled ${received}` : 'Waiting for a reading'}</p>
            </div>
            <div className="grid border-t border-border md:grid-cols-2">
              <Reading label="Scanner" metric="probe_success" value={formatMetric(van.modality_up)} />
              <Reading label="Transfers in progress" metric="deos_sync_queue_active_count" value={formatMetric(van.sync_active)} />
              <Reading label="Hospital link" metric="deos_sync_destination_status" value={formatMetric(van.sync_dest_up)} />
              <Reading label="Transfers complete" metric="deos_sync_queue_complete_count" value={formatMetric(van.sync_complete)} />
              <Reading label="Patients" metric="orthanc_number_of_patients_today" value={formatMetric(patients)} />
              <Reading label="Transfers retrying" metric="deos_sync_queue_retry_count" value={formatMetric(van.sync_retry)} />
              <Reading label="Studies" metric="orthanc_number_of_studies_today" value={formatMetric(van.studies_today)} />
              <Reading label="Database" metric="deos_db_status" value={formatMetric(van.db_up)} />
              <Reading label="Scheduled" metric="deos_worklist_today_count" value={formatMetric(scheduled)} />
              <Reading label="Image store" metric="deos_orthanc_status" value={formatMetric(van.orthanc_up)} />
              <Reading label="Upload speed, MB/s" metric="deos_sync_transfer_speed" value={van.sync_speed == null ? '—' : van.sync_speed.toFixed(2)} />
              <Reading label="Version" metric="deos_version" value={van.version ?? '—'} />
              <Reading label="Failed transfers" metric="deos_sync_queue_failed_count" value={formatMetric(van.sync_failed)} />
              <Reading label="Updates" metric="up" value={formatMetric(van.scrape_up)} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={cn(cardClass, 'rounded-lg')}>
            <VanMap van={van} vans={data.vans} />
            <dl className="space-y-3 px-4 py-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Coordinates</dt>
                <dd className="font-medium tabular-nums">
                  {van.latitude != null && van.longitude != null
                    ? `${van.latitude.toFixed(5)}, ${van.longitude.toFixed(5)}`
                    : 'No GPS fix'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Accuracy</dt>
                <dd className="font-medium">{van.gps_accuracy != null ? `${van.gps_accuracy.toFixed(1)} m` : 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium">{van.gps_source === 'last_known' ? 'Last known fix' : 'Live fix from the van'}</dd>
              </div>
            </dl>
          </section>

          <section className={cn(cardClass, 'rounded-lg p-4')}>
            <h2 className="text-base font-medium">Reports</h2>
            {report?.van ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Included in {trustName} reports.
                </p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Daily report
                    <Switch
                      size="sm"
                      checked={report.van.daily_enabled}
                      disabled={!canWrite}
                      onCheckedChange={(checked) => {
                        void updateVan(report.van!.id, { daily_enabled: checked }, 'Daily report updated')
                      }}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Weekly report
                    <Switch
                      size="sm"
                      checked={report.van.weekly_enabled}
                      disabled={!canWrite}
                      onCheckedChange={(checked) => {
                        void updateVan(report.van!.id, { weekly_enabled: checked }, 'Weekly report updated')
                      }}
                    />
                  </label>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {report.trust.recipients.filter((person) => person.active).map((person) => person.email).join(', ') || 'No recipients yet.'}{' '}
                  <Link to="/reports" className="text-foreground underline underline-offset-2">Manage recipients</Link>
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                This van is not on a report list yet.{' '}
                <Link to="/reports" className="text-foreground underline underline-offset-2">Set up reports</Link>
              </p>
            )}
          </section>

          <TicketCard tickets={openTickets} />
        </aside>
      </div>
    </div>
  )
}

const STATUS_MARKER: Record<FleetStatus, string> = {
  green: '#10b981',
  amber: '#f97316',
  grey: '#a1a1aa',
  red: '#ef4444',
}

function VanMap({ van, vans }: { van: FleetVan; vans: FleetVan[] }) {
  const navigate = useNavigate()
  const mapRef = useRef<MapRef>(null)
  const located = isPlottableGps(van.latitude, van.longitude)
  const points = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: vans
        .filter((item) => isPlottableGps(item.latitude, item.longitude))
        .map((item) => ({
          type: 'Feature' as const,
          properties: {
            instance: item.instance,
            color: STATUS_MARKER[item.status],
            selected: item.instance === van.instance ? 1 : 0,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [item.longitude as number, item.latitude as number],
          },
        })),
    }),
    [vans, van.instance],
  )

  useEffect(() => {
    if (!located) return
    mapRef.current?.flyTo({
      center: [van.longitude as number, van.latitude as number],
      zoom: 15,
      duration: 600,
    })
  }, [located, van.instance, van.latitude, van.longitude])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-52 items-center justify-center bg-muted/30 p-6">
        <PageEmptyState title="Map unavailable" description="Set VITE_MAPBOX_TOKEN to show this van on the map." />
      </div>
    )
  }

  return (
    <section className="relative h-52 w-full overflow-hidden bg-muted/30">
      <MapView
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        initialViewState={
          located
            ? { longitude: van.longitude as number, latitude: van.latitude as number, zoom: 15 }
            : { longitude: -1.5, latitude: 54.5, zoom: 5.2 }
        }
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['van-points']}
        onClick={(event) => {
          const feature = event.features?.[0] as { properties?: { instance?: string } } | undefined
          const next = feature?.properties?.instance
          if (next && next !== van.instance) navigate(vanPath(next))
        }}
      >
        <NavigationControl position="top-left" showCompass={false} />
        <Source id="van-page" type="geojson" data={points}>
          <Layer
            id="van-points"
            type="circle"
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['case', ['==', ['get', 'selected'], 1], 11, 6],
              'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5],
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      </MapView>
    </section>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium tabular-nums', tone)}>{value}</dd>
    </div>
  )
}

function Reading({ label, metric, value }: { label: string; metric: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{metric}</p>
      </div>
      <p className="shrink-0 font-medium tabular-nums">{value}</p>
    </div>
  )
}

function TicketCard({ tickets }: { tickets: SupportTicket[] }) {
  return (
    <section className={cn(cardClass, 'rounded-lg')}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-base font-medium">Open tickets</h2>
        <Link to="/tickets" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          All tickets
        </Link>
      </div>
      {tickets.length ? (
        <ul className="divide-y divide-border border-t border-border">
          {tickets.map((ticket) => {
            const when = ago(ticket.updated_at)
            const body = (
              <>
                <p className="text-xs capitalize text-muted-foreground">
                  #{ticket.id}
                  {ticket.source ? ` · ${ticket.source}` : ''}
                  {ticket.priority ? ` · ${ticket.priority}` : ''}
                </p>
                <p className="mt-1 font-medium">{ticket.subject}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ticket.assignee ? `Assigned to ${ticket.assignee}` : ticket.status}
                  {when ? ` · updated ${when}` : ''}
                </p>
              </>
            )
            return (
              <li key={ticket.id} className="px-4 py-3 text-sm">
                {ticket.url ? (
                  <a href={ticket.url} target="_blank" rel="noreferrer" className="block hover:underline">
                    {body}
                  </a>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground">No open tickets for this van.</p>
      )}
    </section>
  )
}
