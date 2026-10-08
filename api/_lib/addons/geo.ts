/** GPS helpers shared by the fleet map, location history, and daily capture. */

export const POOR_ACCURACY_M = 50
export const RING_ACCURACY_M = 15
export const MOVE_METRES = 40
export const STAY_METRES = 150
export const HEARTBEAT_MS = 20 * 60 * 1000

export type GpsFix = {
  latitude: number
  longitude: number
  accuracy_m: number | null
  recorded_at: string
  status?: string | null
}

export function isPlottableGps(latitude: number | null, longitude: number | null) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false
  // Modems with no fix often report 0,0.
  if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) return false
  return true
}

export type GpsHealth = 'ok' | 'poor' | 'no_fix'

export function gpsHealth(input: {
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
}): GpsHealth {
  if (!isPlottableGps(input.latitude, input.longitude)) return 'no_fix'
  if (input.accuracy_m != null && input.accuracy_m >= POOR_ACCURACY_M) return 'poor'
  return 'ok'
}

export function haversineMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type StoreReason = 'first' | 'move' | 'status' | 'heartbeat'

/** Keep site stays and real moves. Drop small jumps from a weak fix. */
export function shouldStorePoint(
  previous: GpsFix | null,
  next: GpsFix,
): StoreReason | null {
  if (!isPlottableGps(next.latitude, next.longitude)) return null
  if (!previous || !isPlottableGps(previous.latitude, previous.longitude)) return 'first'
  if (previous.status && next.status && previous.status !== next.status) return 'status'
  const moved = haversineMetres(previous, next)
  const threshold = Math.max(MOVE_METRES, previous.accuracy_m ?? 0, next.accuracy_m ?? 0)
  if (moved > threshold) return 'move'
  const age = new Date(next.recorded_at).getTime() - new Date(previous.recorded_at).getTime()
  if (Number.isFinite(age) && age >= HEARTBEAT_MS) return 'heartbeat'
  return null
}

export function destination(
  latitude: number,
  longitude: number,
  bearingDeg: number,
  distanceM: number,
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earth = 6_371_000
  const angular = distanceM / earth
  const bearing = toRad(bearingDeg)
  const lat1 = toRad(latitude)
  const lng1 = toRad(longitude)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  }
}

/** Polygon ring so a weak fix is drawn as an area, not a false pin. */
export function accuracyRing(latitude: number, longitude: number, accuracyM: number) {
  const steps = 32
  const ring: Array<[number, number]> = []
  for (let i = 0; i <= steps; i += 1) {
    const point = destination(latitude, longitude, (i / steps) * 360, accuracyM)
    ring.push([point.longitude, point.latitude])
  }
  return ring
}

export type TrackPoint = GpsFix & { status: string | null }

export type TimelineEvent = {
  kind: 'stay' | 'move'
  from: string
  to: string
  latitude: number
  longitude: number
  endLatitude: number | null
  endLongitude: number | null
  status: string | null
}

export function condenseTrack(points: TrackPoint[]): TimelineEvent[] {
  const ordered = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  )
  const events: TimelineEvent[] = []
  let stay: TrackPoint[] = []

  function closeStay() {
    if (!stay.length) return
    const first = stay[0]
    const last = stay[stay.length - 1]
    events.push({
      kind: 'stay',
      from: first.recorded_at,
      to: last.recorded_at,
      latitude: first.latitude,
      longitude: first.longitude,
      endLatitude: null,
      endLongitude: null,
      status: last.status,
    })
    stay = []
  }

  for (const point of ordered) {
    if (!stay.length) {
      stay = [point]
      continue
    }
    const anchor = stay[0]
    if (haversineMetres(anchor, point) <= Math.max(STAY_METRES, point.accuracy_m ?? 0)) {
      stay.push(point)
      continue
    }
    const previous = stay[stay.length - 1]
    closeStay()
    events.push({
      kind: 'move',
      from: previous.recorded_at,
      to: point.recorded_at,
      latitude: previous.latitude,
      longitude: previous.longitude,
      endLatitude: point.latitude,
      endLongitude: point.longitude,
      status: point.status,
    })
    stay = [point]
  }
  closeStay()
  return events
}

export type SiteVisit = {
  latitude: number
  longitude: number
  from: string
  to: string
  days: number
}

/** Group stays that share a rough position across days. */
export function siteVisits(events: TimelineEvent[]): SiteVisit[] {
  const stays = events.filter((event) => event.kind === 'stay')
  const groups: SiteVisit[] = []
  for (const stay of stays) {
    const existing = groups.find(
      (group) => haversineMetres(group, stay) <= STAY_METRES,
    )
    const day = stay.from.slice(0, 10)
    if (!existing) {
      groups.push({
        latitude: stay.latitude,
        longitude: stay.longitude,
        from: stay.from,
        to: stay.to,
        days: 1,
      })
      continue
    }
    if (stay.from < existing.from) existing.from = stay.from
    if (stay.to > existing.to) existing.to = stay.to
    const seen = new Set(
      stays
        .filter((item) => haversineMetres(existing, item) <= STAY_METRES)
        .map((item) => item.from.slice(0, 10)),
    )
    seen.add(day)
    existing.days = seen.size
  }
  return groups.sort((a, b) => (a.to < b.to ? 1 : -1))
}
