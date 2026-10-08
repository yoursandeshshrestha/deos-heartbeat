import 'mapbox-gl/dist/mapbox-gl.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import MapView, {
  Layer,
  NavigationControl,
  Source,
  type MapMouseEvent,
  type MapRef,
} from 'react-map-gl/mapbox'
import useSWR from 'swr'
import { useHeaderSlot } from '@/components/layout/header-slot'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { TicketsPayload } from '@/lib/addon-types'
import type { FleetPayload, FleetStatus, FleetVan } from '@/lib/fleet-types'
import { RING_ACCURACY_M, accuracyRing, isPlottableGps } from '@/lib/gps'
import { serverFetch } from '@/lib/serverApi'
import { cn } from '@/lib/utils'
import { vanPath } from '@/lib/van-path'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ''
const SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12'
const STREETS = 'mapbox://styles/mapbox/streets-v12'
const UK_CENTER = { longitude: -1.5, latitude: 54.5, zoom: 5.2 }
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
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Fleet API ${response.status}`)
  return response.json()
}

const ticketFetcher = async (url: string): Promise<TicketsPayload> => {
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Tickets API ${response.status}`)
  return response.json()
}

function hasCoords(van: FleetVan): van is FleetVan & { latitude: number; longitude: number } {
  return isPlottableGps(van.latitude, van.longitude)
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
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
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

function trustLabel(slug: string) {
  return slug.replace(/_/g, ' ')
}

export function FleetMapPage() {
  const navigate = useNavigate()
  const headerSlot = useHeaderSlot()
  const { data, error, isLoading } = useSWR<FleetPayload>('/api/fleet', fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })
  const { data: tickets } = useSWR<TicketsPayload>('/api/tickets?status=open', ticketFetcher)
  const [showLastKnown, setShowLastKnown] = useState(true)
  const [satellite, setSatellite] = useState(false)
  const [trustFilter, setTrustFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const mapRef = useRef<MapRef>(null)
  const fitted = useRef(false)

  useEffect(() => {
    setShowLastKnown(readShowLastKnown())
  }, [])

  function onShowLastKnownChange(next: boolean) {
    setShowLastKnown(next)
    fitted.current = false
    try {
      localStorage.setItem(SHOW_LAST_KNOWN_KEY, next ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const vans = useMemo(() => data?.vans ?? [], [data])
  const filtered = useMemo(() => {
    return vans.filter((van) => {
      if (trustFilter !== 'all' && (van.trust ?? 'unassigned') !== trustFilter) return false
      if (statusFilter !== 'all' && van.status !== statusFilter) return false
      return true
    })
  }, [vans, trustFilter, statusFilter])

  const located = useMemo(() => {
    return filtered.filter(hasCoords).filter((van) => {
      if (!showLastKnown && van.gps_source === 'last_known') return false
      return true
    })
  }, [filtered, showLastKnown])

  const trustOptions = useMemo(() => {
    const slugs = new Set(vans.map((van) => van.trust ?? 'unassigned'))
    return [
      { label: 'All trusts', value: 'all' },
      ...[...slugs].sort().map((slug) => ({ label: trustLabel(slug), value: slug })),
    ]
  }, [vans])

  const statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Online', value: 'green' },
    { label: 'Degraded', value: 'amber' },
    { label: 'Not scheduled', value: 'grey' },
    { label: 'Offline', value: 'red' },
  ]

  const points = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: located.map((van) => ({
        type: 'Feature' as const,
        properties: {
          id: van.id ?? van.instance,
          instance: van.instance,
          color: STATUS_MARKER[van.status],
          lastKnown: van.gps_source === 'last_known' ? 1 : 0,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [van.longitude, van.latitude],
        },
      })),
    }
  }, [located])

  const rings = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: located
        .filter((van) => (van.gps_accuracy ?? 0) >= RING_ACCURACY_M)
        .map((van) => ({
          type: 'Feature' as const,
          properties: { id: van.id ?? van.instance },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [accuracyRing(van.latitude, van.longitude, van.gps_accuracy ?? 0)],
          },
        })),
    }
  }, [located])

  const openByInstance = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ticket of tickets?.tickets ?? []) {
      if (!ticket.instance) continue
      counts.set(ticket.instance, (counts.get(ticket.instance) ?? 0) + 1)
    }
    return counts
  }, [tickets])

  useEffect(() => {
    if (!located.length || fitted.current) return
    const map = mapRef.current
    if (!map) return
    fitted.current = true
    if (located.length === 1) {
      map.flyTo({ center: [located[0].longitude, located[0].latitude], zoom: 8, duration: 0 })
      return
    }
    const lngs = located.map((van) => van.longitude)
    const lats = located.map((van) => van.latitude)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, duration: 0, maxZoom: 8 },
    )
  }, [located])

  function onMapClick(event: MapMouseEvent) {
    const feature = event.features?.[0] as
      | {
          properties?: { cluster?: boolean; cluster_id?: number; id?: string; instance?: string }
          geometry?: { coordinates?: [number, number] }
        }
      | undefined
    if (!feature?.properties) return
    const clusterId = feature.properties.cluster_id
    if (feature.properties.cluster && clusterId != null) {
      const map = mapRef.current?.getMap()
      const source = map?.getSource('vans') as {
        getClusterExpansionZoom: (
          id: number,
          callback: (error: Error | null, zoom: number) => void,
        ) => void
      }
      const coords = feature.geometry?.coordinates
      if (!coords) return
      source?.getClusterExpansionZoom(clusterId, (zoomError, zoom) => {
        if (zoomError) return
        map?.easeTo({ center: coords, zoom })
      })
      return
    }
    const instance = feature.properties.instance
    if (instance) navigate(vanPath(String(instance)))
  }

  if (isLoading && !data) return <PageLoading />
  if (error && !data) {
    return (
      <div className="p-6">
        <PageEmptyState title="Fleet map unavailable" description={error.message} />
      </div>
    )
  }
  if (!data) return null

  const liveCount = located.filter((van) => van.gps_source === 'live').length
  const lastKnownCount = located.filter((van) => van.gps_source === 'last_known').length

  const headerControls = (
    <>
      <p className="shrink-0 text-sm text-muted-foreground">
        {liveCount} live
        {showLastKnown && lastKnownCount ? ` · ${lastKnownCount} last known` : null}
      </p>
      <div className="w-40 shrink-0">
        <Combobox data={trustOptions} type="trust" value={trustFilter} onValueChange={(value) => {
          setTrustFilter(value)
          fitted.current = false
        }}>
          <ComboboxTrigger className="h-8 w-full" />
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
      <div className="w-40 shrink-0">
        <Combobox data={statusOptions} type="status" value={statusFilter} onValueChange={(value) => {
          setStatusFilter(value)
          fitted.current = false
        }}>
          <ComboboxTrigger className="h-8 w-full" />
          <ComboboxContent>
            <ComboboxInput />
            <ComboboxList>
              <ComboboxEmpty>No status found</ComboboxEmpty>
              <ComboboxGroup>
                {statusOptions.map((option) => (
                  <ComboboxItem key={option.value} value={option.value}>
                    {option.label}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Label htmlFor="show-last-known" className="text-sm font-normal">
          Show last known
        </Label>
        <Switch
          id="show-last-known"
          checked={showLastKnown}
          onCheckedChange={onShowLastKnownChange}
        />
      </div>
    </>
  )

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full overflow-hidden">
      {headerSlot ? createPortal(headerControls, headerSlot) : null}
      <section className="relative min-w-0 flex-1 bg-muted/30">
        {!MAPBOX_TOKEN ? (
          <div className="flex h-full items-center justify-center p-8">
            <PageEmptyState
              title="Mapbox token missing"
              description="Set VITE_MAPBOX_TOKEN in .env to load satellite imagery."
            />
          </div>
        ) : (
          <MapView
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={satellite ? SATELLITE : STREETS}
            projection={{ name: 'globe' }}
            initialViewState={UK_CENTER}
            style={{ width: '100%', height: '100%' }}
            interactiveLayerIds={['clusters', 'van-points']}
            onClick={onMapClick}
          >
            <NavigationControl position="top-left" showCompass={false} />
            <Source id="accuracy" type="geojson" data={rings}>
              <Layer
                id="accuracy-fill"
                type="fill"
                paint={{ 'fill-color': '#f97316', 'fill-opacity': 0.22 }}
              />
            </Source>
            <Source id="vans" type="geojson" data={points} cluster clusterRadius={48} clusterMaxZoom={11}>
              <Layer
                id="clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': '#0f172a',
                  'circle-radius': ['step', ['get', 'point_count'], 16, 8, 20, 20, 26],
                  'circle-opacity': 0.85,
                }}
              />
              <Layer
                id="cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': ['get', 'point_count_abbreviated'],
                  'text-size': 12,
                }}
                paint={{ 'text-color': '#ffffff' }}
              />
              <Layer
                id="van-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': ['get', 'color'],
                  'circle-radius': 7,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#ffffff',
                  'circle-opacity': ['case', ['==', ['get', 'lastKnown'], 1], 0.55, 1],
                }}
              />
            </Source>
          </MapView>
        )}
        <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-md bg-background/95 p-1 shadow-sm">
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              satellite ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
            onClick={() => setSatellite(true)}
          >
            Satellite
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              !satellite ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
            onClick={() => setSatellite(false)}
          >
            Streets
          </button>
        </div>
        {data.stale ? (
          <div className="absolute bottom-4 left-4 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-900 dark:text-orange-200">
            Data delayed — last good fleet snapshot
          </div>
        ) : null}
      </section>

      <aside className="flex w-full max-w-[380px] shrink-0 flex-col border-l border-black/6 bg-background dark:border-white/6">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!located.length ? (
            <div className="p-4">
              <PageEmptyState
                title="No van locations"
                description="Vans without a GPS fix are not plotted."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {located.map((van) => {
                const id = van.id ?? van.instance
                const ticketsOpen = openByInstance.get(van.instance) ?? 0
                return (
                  <li key={id}>
                    <Link
                      to={vanPath(van.instance)}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium capitalize">{shortVanName(van)}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                          <span className={cn('size-2 rounded-full', STATUS_DOT[van.status])} />
                          {STATUS_LABEL[van.status]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {van.gps_accuracy != null ? `±${formatMetric(van.gps_accuracy)} m` : 'Accuracy unknown'}
                        {ticketsOpen ? ` · ${ticketsOpen} open ticket${ticketsOpen === 1 ? '' : 's'}` : ''}
                      </p>
                    </Link>
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
