import { supabase as supabaseEnv } from '../env.js'
import type { FleetPayload } from '../fleet/types.js'
import { getServiceClient } from '../supabase.js'
import { shouldStorePoint, type GpsFix } from './geo.js'
import { applySample, londonDay, type DailySummaryRow } from './snapshot.js'

const PAGE = 1000

function configured() {
  return Boolean(supabaseEnv.url() && supabaseEnv.serviceRoleKey())
}

async function loadToday(day: string, instances: string[]) {
  const map = new Map<string, DailySummaryRow>()
  if (!instances.length) return map
  const db = getServiceClient()
  const { data, error } = await db
    .from('van_daily_summaries')
    .select('*')
    .eq('day', day)
    .in('instance', instances)
  if (error) throw new Error(error.message)
  for (const row of (data ?? []) as DailySummaryRow[]) {
    map.set(row.instance, row)
  }
  return map
}

async function loadLastFixes(instances: string[]) {
  const map = new Map<string, GpsFix>()
  if (!instances.length) return map
  const db = getServiceClient()
  const { data, error } = await db
    .from('van_locations')
    .select('instance, latitude, longitude, accuracy_m, status, recorded_at')
    .in('instance', instances)
  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    map.set(row.instance as string, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),
      status: (row.status as string | null) ?? null,
      recorded_at: row.recorded_at as string,
    })
  }
  return map
}

/**
 * Persist today's figures and a condensed GPS track.
 * Called only for a fresh Grafana read. Failures must not break the live fleet API.
 */
export async function recordFleetSnapshot(payload: FleetPayload) {
  if (!configured() || payload.source !== 'grafana' || payload.stale) return
  const now = new Date(payload.fetchedAt)
  const day = londonDay(now)
  const instances = payload.vans.map((van) => van.instance)
  const [existing, fixes] = await Promise.all([
    loadToday(day, instances),
    loadLastFixes(instances),
  ])

  const reasons = new Map<string, ReturnType<typeof shouldStorePoint>>()
  const points: Array<Record<string, unknown>> = []
  for (const van of payload.vans) {
    if (van.gps_source !== 'live' || van.latitude == null || van.longitude == null) continue
    const next: GpsFix = {
      latitude: van.latitude,
      longitude: van.longitude,
      accuracy_m: van.gps_accuracy,
      status: van.status,
      recorded_at: van.gps_recorded_at ?? payload.fetchedAt,
    }
    const reason = shouldStorePoint(fixes.get(van.instance) ?? null, next)
    reasons.set(van.instance, reason)
    if (!reason) continue
    points.push({
      instance: van.instance,
      latitude: next.latitude,
      longitude: next.longitude,
      accuracy_m: next.accuracy_m,
      status: van.status,
      recorded_at: next.recorded_at,
    })
  }

  const summaries = payload.vans.map((van) =>
    applySample(existing.get(van.instance) ?? null, van, now, day, reasons.get(van.instance) ?? null),
  )

  const db = getServiceClient()
  if (points.length) {
    const { error } = await db.from('van_location_points').insert(points)
    if (error) throw new Error(error.message)
  }
  if (summaries.length) {
    const { error } = await db
      .from('van_daily_summaries')
      .upsert(summaries, { onConflict: 'instance,day' })
    if (error) throw new Error(error.message)
  }
}

export async function loadSummaries(from: string, to: string) {
  const db = getServiceClient()
  const rows: DailySummaryRow[] = []
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db
      .from('van_daily_summaries')
      .select('*')
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true })
      .range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as DailySummaryRow[]
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}
