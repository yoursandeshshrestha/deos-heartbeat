import useSWR from 'swr'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { FleetPayload, FleetStatus, FleetThresholds, FleetVan } from '@/lib/fleet-types'

const fetcher = async (url: string): Promise<FleetPayload> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fleet API ${response.status}`)
  }
  return response.json()
}

const STATUS_STYLE: Record<FleetStatus, string> = {
  red: 'bg-red-600/90 text-white',
  amber: 'bg-orange-500/90 text-white',
  grey: 'bg-zinc-400/80 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100',
  green: 'bg-emerald-600/90 text-white',
}

const STATUS_LABEL: Record<FleetStatus, string> = {
  green: 'Healthy',
  amber: 'Degraded',
  grey: 'Not scheduled',
  red: 'Offline',
}

const STATUS_ORDER: FleetStatus[] = ['green', 'amber', 'grey', 'red']

const STATUS_BAR_COLOR: Record<FleetStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-orange-500',
  grey: 'bg-zinc-400 dark:bg-zinc-500',
  red: 'bg-red-500',
}

const STATUS_TEXT_COLOR: Record<FleetStatus, string> = {
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-orange-700 dark:text-orange-300',
  grey: 'text-zinc-600 dark:text-zinc-300',
  red: 'text-red-700 dark:text-red-300',
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
  const modalityUp = vans.filter((van) => van.modality_up === 1).length
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
    modalityUp,
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
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
      <div className="content-section__header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-normal">Fleet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live van health · source {data.source}
            {data.fetchedAt
              ? ` · ${new Date(data.fetchedAt).toLocaleTimeString()}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setThresholdsOpen(true)}>
              Thresholds
            </Button>
          ) : null}
          <div className="w-[200px]">
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

        <section aria-label="Fleet status" className="grid gap-4 lg:grid-cols-12">
          <div className="surface-card flex flex-col gap-5 p-5 lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  Fleet health
                </p>
                <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
                  {summary.online}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{summary.vans}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  online · {trustCount} trust{trustCount === 1 ? '' : 's'} ·{' '}
                  {summary.modalityUp} modality up
                </p>
              </div>
              <div className="rounded-full bg-muted/60 px-3 py-1 text-xs tabular-nums text-muted-foreground">
                {summary.vans
                  ? Math.round((summary.online / summary.vans) * 100)
                  : 0}
                % up
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {STATUS_ORDER.map((status) =>
                  counts[status] > 0 && summary.vans > 0 ? (
                    <div
                      key={status}
                      className={cn('h-full transition-[width]', STATUS_BAR_COLOR[status])}
                      style={{ width: `${(counts[status] / summary.vans) * 100}%` }}
                      title={`${STATUS_LABEL[status]}: ${counts[status]}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className={cn('min-w-0', STATUS_TEXT_COLOR[status])}>
                    <div className="truncate opacity-80">{STATUS_LABEL[status]}</div>
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {counts[status]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="surface-card flex flex-col gap-4 p-5 lg:col-span-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Today&apos;s volume
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Counts across the filtered fleet
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricTile label="Patients" value={summary.patients} />
              <MetricTile label="Studies" value={summary.studies} />
              <MetricTile label="Worklist" value={summary.worklist} />
            </div>
            <div className="mt-auto space-y-2">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Day progress</span>
                <span className="font-medium tabular-nums">
                  {summary.progressPct == null
                    ? '—'
                    : `${Math.round(summary.progressPct)}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/80 transition-[width]"
                  style={{
                    width: `${Math.min(100, Math.max(0, summary.progressPct ?? 0))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">patients ÷ worklist</p>
            </div>
          </div>

          <div className="surface-card flex flex-col gap-4 p-5 lg:col-span-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Sync
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Transfer health</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Queue pressure</div>
                  <div
                    className={cn(
                      'mt-1 text-3xl font-medium tabular-nums tracking-tight',
                      summary.failed + summary.retry > 0 &&
                        'text-orange-700 dark:text-orange-300',
                    )}
                  >
                    {summary.failed + summary.retry}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    <span className="tabular-nums text-foreground">{summary.failed}</span>{' '}
                    failed
                  </div>
                  <div>
                    <span className="tabular-nums text-foreground">{summary.retry}</span>{' '}
                    retry
                  </div>
                  <div>
                    <span className="tabular-nums text-foreground">{summary.active}</span>{' '}
                    active
                  </div>
                </div>
              </div>
              <div className="border-t border-border-subtle pt-3">
                <div className="text-xs text-muted-foreground">Avg sync speed</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-medium tabular-nums tracking-tight">
                    {summary.avgSpeed == null ? '—' : summary.avgSpeed.toFixed(2)}
                  </span>
                  {summary.avgSpeed != null ? (
                    <span className="text-xs text-muted-foreground">MB/s</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Offline: modality/sync/scrape down. Not scheduled: online but no worklist or
          patients today. Degraded: sync queues, slow transfer, or low midday progress.
          Healthy: passing checks. Open a van for the exact reason. Totals follow the
          trust filter above.
        </p>

        {!visibleTrusts.length ? (
          <PageEmptyState
            title="No vans in view"
            description="Add vans under Reports, or wait for Grafana auto-discovery."
          />
        ) : (
          <div className="space-y-6">
            {visibleTrusts.map((group) => {
              const isCollapsed = collapsed[group.trust] === true
              return (
                <section key={group.trust}>
                  <button
                    type="button"
                    className="mb-3 flex w-full items-center justify-between text-left"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [group.trust]: !isCollapsed,
                      }))
                    }
                  >
                    <div>
                      <h2 className="text-sm font-medium capitalize">{group.trust}</h2>
                      <p className="text-xs text-muted-foreground">
                        {group.vans.length} van{group.vans.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {STATUS_ORDER.map((status) =>
                        group.counts[status] ? (
                          <Badge key={status} variant="outline">
                            {STATUS_LABEL[status]} {group.counts[status]}
                          </Badge>
                        ) : null,
                      )}
                    </div>
                  </button>
                  {!isCollapsed ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {group.vans.map((van) => (
                        <button
                          key={van.instance}
                          type="button"
                          onClick={() => setSelected(van)}
                          className={cn(
                            'flex min-h-[72px] flex-col items-start justify-between rounded-lg p-3 text-left transition-opacity hover:opacity-90',
                            STATUS_STYLE[van.status],
                          )}
                        >
                          <span className="line-clamp-2 text-sm font-medium leading-tight">
                            {van.display_name}
                          </span>
                          <span className="text-[11px] font-medium tracking-wide opacity-90">
                            {STATUS_LABEL[van.status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.display_name}</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selected.instance}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium uppercase',
                      STATUS_STYLE[selected.status],
                    )}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                  <span className="text-sm text-muted-foreground">{selected.reason}</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Patients today" value={selected.patients_today} />
                  <Metric label="Studies today" value={selected.studies_today} />
                  <Metric label="Worklist" value={selected.worklist_today} />
                  <Metric label="Sync speed" value={selected.sync_speed} suffix=" MB/s" />
                  <Metric label="Sync failed" value={selected.sync_failed} />
                  <Metric label="Sync retry" value={selected.sync_retry} />
                  <Metric label="Sync active" value={selected.sync_active} />
                  <Metric label="Sync complete" value={selected.sync_complete} />
                  <Metric label="Modality" value={selected.modality_up} />
                  <Metric label="Sync dest" value={selected.sync_dest_up} />
                  <Metric label="DB" value={selected.db_up} />
                  <Metric label="Orthanc" value={selected.orthanc_up} />
                  <Metric label="Scrape" value={selected.scrape_up} />
                  <Metric label="Version" value={selected.version} />
                </dl>
              </div>
            </>
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

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums tracking-tight">{value}</div>
    </div>
  )
}

function Metric({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number | string | null
  suffix?: string
}) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">
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
      <DialogContent>
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
