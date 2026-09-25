import useSWR from 'swr'
import { useMemo, useState } from 'react'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { FleetPayload, FleetStatus, FleetVan } from '@/lib/fleet-types'

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

function countStatuses(vans: FleetVan[]) {
  return vans.reduce(
    (acc, van) => {
      acc[van.status] += 1
      return acc
    },
    { red: 0, amber: 0, grey: 0, green: 0 } as Record<FleetStatus, number>,
  )
}

export function FleetPage() {
  const { data, error, isLoading } = useSWR<FleetPayload>('/api/fleet', fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })

  const [trustFilter, setTrustFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<FleetVan | null>(null)

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

      <div className="content-section__content space-y-6 pt-6">
        {data.stale ? (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-900 dark:text-orange-200">
            Data delayed — showing last good fleet snapshot while Grafana is unreachable.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Red" value={counts.red} className="text-red-700 dark:text-red-300" />
          <Stat label="Amber" value={counts.amber} className="text-orange-700 dark:text-orange-300" />
          <Stat label="Grey" value={counts.grey} className="text-zinc-600 dark:text-zinc-300" />
          <Stat label="Green" value={counts.green} className="text-emerald-700 dark:text-emerald-300" />
        </div>

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
                    <div className="flex gap-1">
                      {(['red', 'amber', 'grey', 'green'] as FleetStatus[]).map((status) =>
                        group.counts[status] ? (
                          <Badge key={status} variant="outline">
                            {status} {group.counts[status]}
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
                          <span className="text-[11px] uppercase tracking-wide opacity-90">
                            {van.status}
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
                    {selected.status}
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
    </div>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border-subtle px-3 py-2', className)}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-medium tabular-nums">{value}</div>
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
