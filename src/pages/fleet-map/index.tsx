import 'mapbox-gl/dist/mapbox-gl.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox'
import useSWR from 'swr'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { FleetPayload, FleetStatus, FleetVan } from '@/lib/fleet-types'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ''
const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'
const UK_CENTER = { longitude: -1.5, latitude: 52.5, zoom: 6.2 }
const SHOW_LAST_KNOWN_KEY = 'fleet-map-show-last-known'

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

const STATUS_MARKER: Record<FleetStatus, string> = {
  green: '#10b981',
  amber: '#f97316',
  grey: '#a1a1aa',
  red: '#ef4444',
}

const fetcher = async (url: string): Promise<FleetPayload> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Fleet API ${response.status}`)
  return response.json()
}

function hasCoords(van: FleetVan): van is FleetVan & { latitude: number; longitude: number } {
  return (
    typeof van.latitude === 'number' &&
    Number.isFinite(van.latitude) &&
    typeof van.longitude === 'number' &&
    Number.isFinite(van.longitude)
  )
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

function formatMetric(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatGpsAge(iso: string | null) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function readShowLastKnown() {
  try {
    const raw = localStorage.getItem(SHOW_LAST_KNOWN_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function FleetMapPage() {
  const { data, error, isLoading } = useSWR<FleetPayload>('/api/fleet', fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLastKnown, setShowLastKnown] = useState(true)
  const mapRef = useRef<MapRef>(null)

  useEffect(() => {
    setShowLastKnown(readShowLastKnown())
  }, [])

  function onShowLastKnownChange(next: boolean) {
    setShowLastKnown(next)
    try {
      localStorage.setItem(SHOW_LAST_KNOWN_KEY, next ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const vans = data?.vans ?? []
  const located = useMemo(() => {
    return vans.filter((van) => {
      if (!hasCoords(van)) return false
      if (!showLastKnown && van.gps_source === 'last_known') return false
      return true
    })
  }, [vans, showLastKnown])

  const lastKnownCount = useMemo(
    () => vans.filter((van) => van.gps_source === 'last_known').length,
    [vans],
  )
  const liveCount = useMemo(
    () => vans.filter((van) => van.gps_source === 'live').length,
    [vans],
  )
  const withoutGpsCount = vans.length - liveCount - lastKnownCount

  const selected =
    located.find((van) => (van.id ?? van.instance) === selectedId) ?? null

  const flyToVan = useCallback((van: FleetVan & { latitude: number; longitude: number }) => {
    mapRef.current?.flyTo({
      center: [van.longitude, van.latitude],
      zoom: 10.5,
      duration: 800,
    })
  }, [])

  useEffect(() => {
    if (!located.length) {
      setSelectedId(null)
      return
    }
    if (selectedId && located.some((van) => (van.id ?? van.instance) === selectedId)) {
      return
    }
    setSelectedId(located[0].id ?? located[0].instance)
  }, [located, selectedId])

  useEffect(() => {
    if (!selected || !hasCoords(selected)) return
    flyToVan(selected)
  }, [selected, flyToVan])

  useEffect(() => {
    if (!located.length) return
    const map = mapRef.current
    if (!map) return
    if (located.length === 1) {
      map.flyTo({
        center: [located[0].longitude, located[0].latitude],
        zoom: 9,
        duration: 0,
      })
      return
    }
    const lngs = located.map((van) => van.longitude)
    const lats = located.map((van) => van.latitude)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, duration: 0, maxZoom: 10 },
    )
  }, [located])

  if (isLoading && !data) return <PageLoading />

  if (error && !data) {
    return (
      <div className="p-6">
        <PageEmptyState title="Fleet map unavailable" description={error.message} />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full overflow-hidden">
      <section className="relative min-w-0 flex-1 bg-muted/30">
        {!MAPBOX_TOKEN ? (
          <div className="flex h-full items-center justify-center p-8">
            <PageEmptyState
              title="Mapbox token missing"
              description="Set VITE_MAPBOX_TOKEN in .env (same Mapbox token used in your other apps)."
            />
          </div>
        ) : (
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={MAP_STYLE}
            initialViewState={UK_CENTER}
            attributionControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-left" showCompass={false} />
            {located.map((van) => {
              const id = van.id ?? van.instance
              const active = id === selectedId
              const lastKnown = van.gps_source === 'last_known'
              return (
                <Marker
                  key={id}
                  longitude={van.longitude}
                  latitude={van.latitude}
                  anchor="center"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation()
                    setSelectedId(id)
                  }}
                >
                  <button
                    type="button"
                    aria-label={van.display_name}
                    className={cn(
                      'size-3.5 rounded-full border-2 border-white shadow-sm transition-transform',
                      lastKnown && 'opacity-55 border-dashed',
                      active && 'scale-125 ring-2 ring-blue-500/40',
                    )}
                    style={{ backgroundColor: STATUS_MARKER[van.status] }}
                  />
                </Marker>
              )
            })}
          </Map>
        )}
        {data.stale ? (
          <div className="absolute bottom-4 left-4 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-900 dark:text-orange-200">
            Data delayed — last good fleet snapshot
          </div>
        ) : null}
      </section>

      <aside className="flex w-full max-w-[380px] shrink-0 flex-col border-l border-black/6 bg-background dark:border-white/6">
        <div className="space-y-3 border-b border-black/6 px-4 py-3 dark:border-white/6">
          <div>
            <p className="text-sm font-medium text-foreground">Vans</p>
            <p className="text-sm text-muted-foreground">
              {liveCount} live
              {showLastKnown && lastKnownCount
                ? ` · ${lastKnownCount} last known`
                : null}
              {withoutGpsCount ? ` · ${withoutGpsCount} without GPS` : null}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-last-known" className="text-sm font-normal">
              Show last known
            </Label>
            <Switch
              id="show-last-known"
              checked={showLastKnown}
              onCheckedChange={onShowLastKnownChange}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!located.length ? (
            <div className="p-4">
              <PageEmptyState
                title="No van locations"
                description={
                  !showLastKnown && lastKnownCount
                    ? 'Turn on “Show last known” to see vans with a previous fix.'
                    : 'GPS coordinates are not available yet for vans in view.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {located.map((van) => {
                const id = van.id ?? van.instance
                const active = id === selectedId
                const lastKnown = van.gps_source === 'last_known'
                const age = lastKnown ? formatGpsAge(van.gps_recorded_at) : null
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className={cn(
                        'flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors',
                        active ? 'bg-[#f3f3f3] dark:bg-muted' : 'hover:bg-muted/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium capitalize">
                          {shortVanName(van)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                          <span
                            className={cn('size-2 rounded-full', STATUS_DOT[van.status])}
                          />
                          {STATUS_LABEL[van.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm capitalize text-muted-foreground">
                        <span>{(van.trust ?? 'unassigned').replace(/_/g, ' ')}</span>
                        {lastKnown ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-wide text-muted-foreground">
                            Last known{age ? ` · ${age}` : ''}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          Patients{' '}
                          <span className="tabular-nums text-foreground">
                            {formatMetric(van.patients_today)}
                          </span>
                        </span>
                        <span>
                          Sync{' '}
                          <span className="tabular-nums text-foreground">
                            {van.sync_speed == null
                              ? '—'
                              : `${van.sync_speed.toFixed(2)} MB/s`}
                          </span>
                        </span>
                        <span>
                          Failed{' '}
                          <span className="tabular-nums text-foreground">
                            {formatMetric(van.sync_failed)}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
