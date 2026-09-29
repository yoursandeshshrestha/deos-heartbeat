import { supabase as supabaseEnv } from '../env.js'
import { getServiceClient } from '../supabase.js'
import type { FleetPayload, FleetVan } from './types.js'

type StoredLocation = {
  instance: string
  latitude: number
  longitude: number
  recorded_at: string
}

function isLiveGps(van: FleetVan) {
  return (
    van.gps_source === 'live' &&
    typeof van.latitude === 'number' &&
    Number.isFinite(van.latitude) &&
    typeof van.longitude === 'number' &&
    Number.isFinite(van.longitude)
  )
}

async function loadStoredLocations(): Promise<Map<string, StoredLocation>> {
  const map = new Map<string, StoredLocation>()
  try {
    if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) return map
    const db = getServiceClient()
    const { data, error } = await db
      .from('van_locations')
      .select('instance, latitude, longitude, recorded_at')
    if (error) throw error
    for (const row of data ?? []) {
      map.set(row.instance, {
        instance: row.instance,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        recorded_at: row.recorded_at,
      })
    }
  } catch {
    // Table may not exist yet locally — ignore.
  }
  return map
}

async function upsertLiveLocations(vans: FleetVan[]) {
  const rows = vans
    .filter(isLiveGps)
    .map((van) => ({
      instance: van.instance,
      latitude: van.latitude as number,
      longitude: van.longitude as number,
      recorded_at: van.gps_recorded_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  if (!rows.length) return
  try {
    if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) return
    const db = getServiceClient()
    await db.from('van_locations').upsert(rows, { onConflict: 'instance' })
  } catch {
    // Ignore persistence failures — live GPS still returned.
  }
}

/** Persist live fixes and fill missing coords from last-known rows. */
export async function applyLastKnownLocations(
  payload: FleetPayload,
): Promise<FleetPayload> {
  await upsertLiveLocations(payload.vans)

  const stored = await loadStoredLocations()
  if (!stored.size) return payload

  const vans = payload.vans.map((van) => {
    if (isLiveGps(van)) return van
    const last = stored.get(van.instance)
    if (
      !last ||
      !Number.isFinite(last.latitude) ||
      !Number.isFinite(last.longitude)
    ) {
      return van
    }
    return {
      ...van,
      latitude: last.latitude,
      longitude: last.longitude,
      gps_source: 'last_known' as const,
      gps_recorded_at: last.recorded_at,
    }
  })

  const byInstance = new Map(vans.map((van) => [van.instance, van]))
  const trusts = payload.trusts.map((group) => ({
    ...group,
    vans: group.vans.map((van) => byInstance.get(van.instance) ?? van),
  }))

  return { ...payload, vans, trusts }
}
