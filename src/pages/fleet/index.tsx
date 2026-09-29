import useSWR from 'swr'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Label as PieLabel, Pie, PieChart } from 'recharts'
import { toast } from 'sonner'
import { FleetBriefing } from '@/components/fleet/FleetBriefing'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CaretDown } from '@phosphor-icons/react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { serverFetch } from '@/lib/serverApi'
import { supabase } from '@/lib/supabase'
import type { FleetPayload, FleetStatus, FleetThresholds, FleetVan } from '@/lib/fleet-types'

const fetcher = async (url: string): Promise<FleetPayload> => {
  const response = await serverFetch(url)
  if (!response.ok) {
    throw new Error(`Fleet API ${response.status}`)
  }
  return response.json()
}

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

const STATUS_BADGE: Record<FleetStatus, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-orange-600 dark:text-orange-400',
  grey: 'text-zinc-500 dark:text-zinc-400',
  red: 'text-red-600 dark:text-red-400',
}

/** Joined card cell inside a gap-px grid */
const joinedCellClass =
  'relative flex min-h-0 w-full flex-col overflow-hidden bg-white text-left dark:bg-card'

const overviewCardClass =
  'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

const vanCols =
  'grid-cols-[minmax(140px,1.4fr)_100px_100px_110px_90px_80px]'

function StatCell({
  title,
  value,
  detail,
}: {
  title: string
  value: ReactNode
  detail: ReactNode
}) {
  return (
    <div className={cn(joinedCellClass, 'gap-1.5 px-4 py-3.5')}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="text-sm leading-snug text-muted-foreground">{detail}</div>
    </div>
  )
}

type DonutSlice = { key: string; value: number; fill: string }

const patientsChartConfig = {
  empty: { label: 'None', color: 'var(--muted)' },
  patients: { label: 'Patients', color: 'var(--chart-1)' },
  remaining: { label: 'Remaining', color: 'var(--muted)' },
} satisfies ChartConfig

const progressChartConfig = {
  empty: { label: 'None', color: 'var(--muted)' },
  done: { label: 'Done', color: 'var(--chart-2)' },
  remaining: { label: 'Remaining', color: 'var(--muted)' },
} satisfies ChartConfig

function OverviewDonutCell({
  title,
  center,
  config,
  data,
  details,
}: {
  title: string
  center: ReactNode
  config: ChartConfig
  data: DonutSlice[]
  details: ReactNode
}) {
  const slices =
    data.filter((entry) => entry.value > 0).length > 0
      ? data.filter((entry) => entry.value > 0)
      : [{ key: 'empty', value: 1, fill: 'var(--color-empty)' }]

  return (
    <div className={cn(joinedCellClass, 'gap-1.5 px-4 py-3.5')}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="flex items-center gap-3">
        <ChartContainer
          config={config}
          className="aspect-square size-[88px] shrink-0"
          initialDimension={{ width: 88, height: 88 }}
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="key"
              innerRadius={28}
              outerRadius={40}
              strokeWidth={2}
            >
              <PieLabel
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) {
                    return null
                  }
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-lg font-semibold tabular-nums"
                      >
                        {center}
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="min-w-0 space-y-1 text-sm leading-snug text-muted-foreground">
          {details}
        </div>
      </div>
    </div>
  )
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

function sumMetric(vans: FleetVan[], key: keyof FleetVan) {
  return vans.reduce((total, van) => {
    const value = van[key]
    return typeof value === 'number' && Number.isFinite(value) ? total + value : total
  }, 0)
}

function formatMetric(value: number | string | null | undefined) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

function shortVanName(van: FleetVan) {
  const name = van.display_name
  const trust = van.trust?.toLowerCase()
  if (trust && name.toLowerCase().startsWith(`${trust}.`)) {
    return name.slice(trust.length + 1)
  }
  const parts = van.instance.split('.')
  if (parts.length > 1) return parts.slice(1).join('.')
  return name
}

function vanProgress(van: FleetVan) {
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

function fleetSummary(vans: FleetVan[]) {
  const patients = sumMetric(vans, 'patients_today')
  const studies = sumMetric(vans, 'studies_today')
  const worklist = sumMetric(vans, 'worklist_today')
  const failed = sumMetric(vans, 'sync_failed')
  const retry = sumMetric(vans, 'sync_retry')
  const active = sumMetric(vans, 'sync_active')
  const speeds = vans
    .map((van) => van.sync_speed)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const avgSpeed =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null
  const online = vans.filter((van) => van.status !== 'red').length
  const progressPct = worklist > 0 ? (patients / worklist) * 100 : null

  return {
    vans: vans.length,
    patients,
    studies,
    worklist,
    failed,
    retry,
    active,
    avgSpeed,
    online,
    progressPct,
  }
}

export function FleetPage() {
  const { role } = useAuth()
  const canWrite = role === 'admin'
  const { data, error, isLoading, mutate } = useSWR<FleetPayload>('/api/fleet', fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })

  const [trustFilter, setTrustFilter] = useState('all')
  const [openTrusts, setOpenTrusts] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<FleetVan | null>(null)
  const [thresholdsOpen, setThresholdsOpen] = useState(false)

  const trustOptions = useMemo(() => {
    const trusts = data?.trusts.map((group) => group.trust) ?? []
    return [
      { label: 'All trusts', value: 'all' },
      ...trusts.map((trust) => ({ label: trust, value: trust })),
    ]
  }, [data])

  const visibleTrusts = useMemo(() => {
    if (!data) return []
    if (trustFilter === 'all') return data.trusts
    return data.trusts.filter((group) => group.trust === trustFilter)
  }, [data, trustFilter])

  const visibleVans = useMemo(
    () => visibleTrusts.flatMap((group) => group.vans),
    [visibleTrusts],
  )
  const counts = countStatuses(visibleVans)
  const summary = useMemo(() => fleetSummary(visibleVans), [visibleVans])
  const trustCount = visibleTrusts.length

  function isTrustOpen(trust: string) {
    if (openTrusts[trust] != null) return openTrusts[trust]
    return true
  }

  function toggleTrust(trust: string) {
    setOpenTrusts((prev) => {
      const currentlyOpen = prev[trust] ?? true
      return { ...prev, [trust]: !currentlyOpen }
    })
  }

  if (isLoading && !data) {
    return <PageLoading />
  }

  if (error && !data) {
    return (
      <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
        <PageEmptyState
          title="Fleet unavailable"
          description={error.message}
        />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Live van health · source {data.source}
          {data.fetchedAt
            ? ` · ${new Date(data.fetchedAt).toLocaleTimeString()}`
            : null}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setThresholdsOpen(true)}>
              Thresholds
            </Button>
          ) : null}
          <div className="w-50">
            <Combobox
              data={trustOptions}
              type="trust"
              value={trustFilter}
              onValueChange={setTrustFilter}
            >
              <ComboboxTrigger className="w-full" />
              <ComboboxContent>
                <ComboboxInput />
                <ComboboxList>
                  <ComboboxEmpty>No trust found</ComboboxEmpty>
                  <ComboboxGroup>
                    {trustOptions.map((option) => (
                      <ComboboxItem key={option.value} value={option.value}>
                        {option.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </div>

      <div className="content-section__content space-y-6 pt-6">
        {data.stale ? (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-900 dark:text-orange-200">
            Data delayed — showing last good fleet snapshot while Grafana is unreachable.
          </div>
        ) : null}

        <FleetBriefing trustFilter={trustFilter} />

        <section aria-label="Fleet status" className={overviewCardClass}>
          <div className={overviewHeaderClass}>
            <span>Overview</span>
          </div>
          <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
            <StatCell
              title="Online"
              value={`${summary.online} / ${summary.vans}`}
              detail={
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {STATUS_ORDER.map((status) =>
                    counts[status] ? (
                      <span
                        key={status}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            STATUS_DOT[status],
                          )}
                        />
                        <span>
                          {STATUS_LABEL[status]}{' '}
                          <span className="tabular-nums text-foreground">
                            {counts[status]}
                          </span>
                        </span>
                      </span>
                    ) : null,
                  )}
                </span>
              }
            />
            <OverviewDonutCell
              title="Patients today"
              center={summary.patients}
              config={patientsChartConfig}
              data={[
                {
                  key: 'patients',
                  value: summary.patients,
                  fill: 'var(--color-patients)',
                },
                {
                  key: 'remaining',
                  value: Math.max(0, summary.worklist - summary.patients),
                  fill: 'var(--color-remaining)',
                },
              ]}
              details={
                <>
                  <div>
                    Studies{' '}
                    <span className="tabular-nums text-foreground">
                      {summary.studies}
                    </span>
                  </div>
                  <div>
                    Worklist{' '}
                    <span className="tabular-nums text-foreground">
                      {summary.worklist}
                    </span>
                  </div>
                  <div>
                    Remaining{' '}
                    <span className="tabular-nums text-foreground">
                      {Math.max(0, summary.worklist - summary.patients)}
                    </span>
                  </div>
                </>
              }
            />
            <OverviewDonutCell
              title="Day progress"
              center={
                summary.progressPct == null
                  ? '—'
                  : `${Math.round(summary.progressPct)}%`
              }
              config={progressChartConfig}
              data={
                summary.progressPct == null
                  ? []
                  : [
                      {
                        key: 'done',
                        value: Math.max(0, Math.round(summary.progressPct)),
                        fill: 'var(--color-done)',
                      },
                      {
                        key: 'remaining',
                        value: Math.max(
                          0,
                          100 - Math.round(summary.progressPct),
                        ),
                        fill: 'var(--color-remaining)',
                      },
                    ]
              }
              details={
                <>
                  <div>
                    Patients{' '}
                    <span className="tabular-nums text-foreground">
                      {summary.patients}/{summary.worklist || '—'}
                    </span>
                  </div>
                  <div>
                    {trustCount === 1 ? '1 trust' : `${trustCount} trusts`}
                  </div>
                </>
              }
            />
            <StatCell
              title="Queue pressure"
              value={summary.failed + summary.retry}
              detail={
                <>
                  Failed{' '}
                  <span className="tabular-nums text-foreground">
                    {summary.failed}
                  </span>
                  <span className="mx-2 text-border">·</span>
                  Retry{' '}
                  <span className="tabular-nums text-foreground">
                    {summary.retry}
                  </span>
                  <span className="mx-2 text-border">·</span>
                  Active{' '}
                  <span className="tabular-nums text-foreground">
                    {summary.active}
                  </span>
                  {summary.avgSpeed != null ? (
                    <>
                      <span className="mx-2 text-border">·</span>
                      <span className="tabular-nums text-foreground">
                        {summary.avgSpeed.toFixed(2)} MB/s
                      </span>
                    </>
                  ) : null}
                </>
              }
            />
          </div>
        </section>

        {!visibleTrusts.length ? (
          <PageEmptyState
            title="No vans in view"
            description="Add vans under Reports, or wait for Grafana auto-discovery."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {visibleTrusts.map((group) => {
              const open = isTrustOpen(group.trust)
              const patients = sumMetric(group.vans, 'patients_today')
              return (
                <section key={group.trust} className={overviewCardClass}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleTrust(group.trust)}
                    className={cn(overviewHeaderClass, 'w-full text-left')}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CaretDown
                        weight="bold"
                        className={cn(
                          'size-3.5 shrink-0 transition-transform duration-150',
                          open ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                      <span className="truncate capitalize text-foreground">
                        {group.trust.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
                      <span className="hidden items-center gap-2.5 sm:flex">
                        {STATUS_ORDER.map((status) =>
                          group.counts[status] ? (
                            <span
                              key={status}
                              className="inline-flex items-center gap-1.5"
                            >
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  STATUS_DOT[status],
                                )}
                              />
                              {group.counts[status]}
                            </span>
                          ) : null,
                        )}
                      </span>
                      <span>
                        {patients === 1
                          ? '1 patient'
                          : `${patients} patients`}
                      </span>
                    </span>
                  </button>

                  {open ? (
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px] px-4 pb-1 pt-3.5">
                        <header
                          className={cn(
                            'grid gap-2 text-sm font-medium text-muted-foreground xl:gap-6',
                            vanCols,
                          )}
                        >
                          <span>Van</span>
                          <span>Status</span>
                          <span>Patients</span>
                          <span>Sync</span>
                          <span>Progress</span>
                          <span>Failed</span>
                        </header>
                        <div className="-mx-4 mt-1 divide-y divide-border">
                          {group.vans.map((van) => (
                            <VanRow
                              key={van.instance}
                              van={van}
                              onSelect={() => setSelected(van)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-border/70 p-0 sm:max-w-md"
        >
          {selected ? (
            <VanDetailPanel van={selected} />
          ) : null}
        </SheetContent>
      </Sheet>

      {canWrite && data.thresholds ? (
        <ThresholdsDialog
          open={thresholdsOpen}
          onOpenChange={setThresholdsOpen}
          thresholds={data.thresholds}
          onSaved={() => void mutate()}
        />
      ) : null}
    </div>
  )
}

function VanRow({ van, onSelect }: { van: FleetVan; onSelect: () => void }) {
  const patients = van.patients_today
  const worklist = van.worklist_today
  const patientsLabel =
    patients == null && worklist == null
      ? '—'
      : `${formatMetric(patients)}/${formatMetric(worklist)}`
  const progress = vanProgress(van)
  const failed = van.sync_failed
  const failedTone =
    failed != null && failed > 0
      ? 'text-red-600 dark:text-red-400'
      : undefined

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'grid h-12 w-full items-center gap-2 px-4 text-left text-base xl:gap-6',
        vanCols,
      )}
    >
      <span className="truncate font-medium tabular-nums">
        {shortVanName(van)}
      </span>
      <span className={cn('inline-flex items-center gap-1.5 text-sm', STATUS_BADGE[van.status])}>
        <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[van.status])} />
        {STATUS_LABEL[van.status]}
      </span>
      <span className="tabular-nums">{patientsLabel}</span>
      <span className="tabular-nums">
        {van.sync_speed == null ? (
          '—'
        ) : (
          <>
            {van.sync_speed.toFixed(2)}{' '}
            <span className="text-muted-foreground">MB/s</span>
          </>
        )}
      </span>
      <span className="tabular-nums">
        {progress == null ? '—' : `${progress}%`}
      </span>
      <span className={cn('tabular-nums', failedTone)}>
        {formatMetric(failed)}
      </span>
    </button>
  )
}

function VanDetailPanel({ van }: { van: FleetVan }) {
  const progress = vanProgress(van)
  const speedLabel =
    van.sync_speed == null
      ? '—'
      : `${Number(van.sync_speed).toFixed(2)} MB/s`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="shrink-0 border-b border-border/70 pr-14 text-left">
        <SheetTitle className="truncate">{van.display_name}</SheetTitle>
        <SheetDescription className="truncate font-mono text-xs">
          {van.instance}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Status
          </p>
          <div className="rounded-md bg-muted/40 px-3 py-3">
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2.5 shrink-0 rounded-full', STATUS_DOT[van.status])}
              />
              <span className="text-sm font-medium">{STATUS_LABEL[van.status]}</span>
            </div>
            {van.reason ? (
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {van.reason}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Today
          </p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-border/70 ring-1 ring-border/70">
            <Metric label="Patients" value={van.patients_today} />
            <Metric label="Studies" value={van.studies_today} />
            <Metric label="Worklist" value={van.worklist_today} />
            <Metric
              label="Progress"
              value={progress == null ? null : `${Math.round(progress * 100)}%`}
            />
          </dl>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Sync
          </p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-border/70 ring-1 ring-border/70">
            <Metric label="Speed" value={speedLabel === '—' ? null : speedLabel} />
            <Metric label="Failed" value={van.sync_failed} />
            <Metric label="Retry" value={van.sync_retry} />
            <Metric label="Active" value={van.sync_active} />
            <Metric label="Complete" value={van.sync_complete} />
            <Metric label="Dest up" value={van.sync_dest_up} />
          </dl>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Health
          </p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-border/70 ring-1 ring-border/70">
            <Metric label="Modality" value={van.modality_up} />
            <Metric label="DB" value={van.db_up} />
            <Metric label="Orthanc" value={van.orthanc_up} />
            <Metric label="Scrape" value={van.scrape_up} />
            <Metric label="Version" value={van.version} className="col-span-2" />
          </dl>
        </section>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  suffix = '',
  className,
}: {
  label: string
  value: number | string | null
  suffix?: string
  className?: string
}) {
  return (
    <div className={cn('bg-white px-3 py-2.5 dark:bg-card', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
        {value == null || value === '' ? '—' : `${value}${suffix}`}
      </dd>
    </div>
  )
}

function ThresholdsDialog({
  open,
  onOpenChange,
  thresholds,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thresholds: FleetThresholds
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(thresholds)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(thresholds)
  }, [open, thresholds])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('settings').upsert(
      {
        key: 'fleet_thresholds',
        value: {
          ...draft,
          poll_interval_seconds: 60,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Fleet thresholds saved')
    onOpenChange(false)
    onSaved()
  }

  function field(key: keyof FleetThresholds, label: string, step = '1') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`th-${key}`}>{label}</Label>
        <Input
          id={`th-${key}`}
          type="number"
          step={step}
          min={0}
          value={draft[key]}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              [key]: Number(event.target.value),
            }))
          }
          required
        />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Fleet thresholds</DialogTitle>
            <DialogDescription>
              Amber / offline rules for the heatmap. Confirm with Viv in UAT (Phase 0 Q6).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {field('speed_floor_mbps', 'Speed floor (MB/s)', '0.05')}
            {field('failed_queue_amber', 'Failed queue → degraded at')}
            {field('retry_queue_amber', 'Retry queue → degraded at')}
            {field('progress_amber_pct', 'Midday progress → degraded below %')}
            {field('scrape_stale_minutes', 'Scrape stale → offline (minutes)')}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} data-dialog-primary-action>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
