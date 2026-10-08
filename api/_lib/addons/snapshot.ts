import type { FleetVan } from '../fleet/types.js'
import { isPlottableGps, type StoreReason } from './geo.js'

export type DailySummaryRow = {
  instance: string
  day: string
  trust_slug: string | null
  display_name: string
  patients: number | null
  studies: number | null
  worklist: number | null
  sync_speed: number | null
  sync_failed: number | null
  sync_complete: number | null
  status: string | null
  observed_seconds: number
  offline_seconds: number
  degraded_seconds: number
  moved: boolean
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  updated_at: string
}

const MAX_GAP_SECONDS = 300

export function londonDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function asNumber(value: number | string | null | undefined) {
  if (value == null) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function higher(current: number | null | undefined, next: number | null | undefined) {
  if (next == null || !Number.isFinite(Number(next))) return current ?? null
  if (current == null || !Number.isFinite(Number(current))) return Number(next)
  return Math.max(Number(current), Number(next))
}

/** Fold one live reading into the van's permanent day row. */
export function applySample(
  existing: DailySummaryRow | null,
  van: FleetVan,
  now: Date,
  day: string,
  storeReason: StoreReason | null,
): DailySummaryRow {
  const sameDay = existing?.day === day
  const previousAt = sameDay && existing?.updated_at ? new Date(existing.updated_at).getTime() : null
  let delta = 0
  if (previousAt != null && Number.isFinite(previousAt)) {
    delta = Math.round((now.getTime() - previousAt) / 1000)
    if (delta < 0) delta = 0
    if (delta > MAX_GAP_SECONDS) delta = MAX_GAP_SECONDS
  }

  const base = sameDay && existing ? existing : null
  const live = isPlottableGps(van.latitude, van.longitude) && van.gps_source === 'live'
  const patients = van.patients_today ?? base?.patients ?? null
  const waiting = van.worklist_today
  const onTheList = patients != null && waiting != null ? Number(patients) + Number(waiting) : waiting
  return {
    instance: van.instance,
    day,
    trust_slug: van.trust,
    display_name: van.display_name,
    patients,
    studies: van.studies_today ?? base?.studies ?? null,
    worklist: higher(higher(base?.worklist, waiting), onTheList),
    sync_speed: van.sync_speed ?? base?.sync_speed ?? null,
    sync_failed: van.sync_failed ?? base?.sync_failed ?? null,
    sync_complete: van.sync_complete ?? base?.sync_complete ?? null,
    status: van.status,
    observed_seconds: asNumber(base?.observed_seconds) + delta,
    offline_seconds: asNumber(base?.offline_seconds) + (van.status === 'red' ? delta : 0),
    degraded_seconds: asNumber(base?.degraded_seconds) + (van.status === 'amber' ? delta : 0),
    moved: Boolean(base?.moved) || storeReason === 'move',
    latitude: live ? van.latitude : (base?.latitude ?? null),
    longitude: live ? van.longitude : (base?.longitude ?? null),
    accuracy_m: live ? van.gps_accuracy : (base?.accuracy_m ?? null),
    updated_at: now.toISOString(),
  }
}
