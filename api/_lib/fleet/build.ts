import { grafana, supabase as supabaseEnv } from '../env.js'
import { getServiceClient } from '../supabase.js'
import { getFleetCache, isFleetCacheFresh, setFleetCache } from './cache.js'
import { fixtureSamples } from './fixtures.js'
import { mergeFleetMetrics, type DbVanRow } from './merge.js'
import { isHubInstance } from './queries.js'
import { fetchAllFleetSamples } from './grafana.js'
import {
  DEFAULT_FLEET_THRESHOLDS,
  type FleetPayload,
  type FleetThresholds,
} from './types.js'

async function loadThresholds(): Promise<FleetThresholds> {
  try {
    if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) {
      return DEFAULT_FLEET_THRESHOLDS
    }
    const db = getServiceClient()
    const { data } = await db
      .from('settings')
      .select('value')
      .eq('key', 'fleet_thresholds')
      .maybeSingle()
    if (!data?.value || typeof data.value !== 'object') {
      return DEFAULT_FLEET_THRESHOLDS
    }
    return { ...DEFAULT_FLEET_THRESHOLDS, ...(data.value as FleetThresholds) }
  } catch {
    return DEFAULT_FLEET_THRESHOLDS
  }
}

async function loadVans(): Promise<DbVanRow[]> {
  try {
    if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) return []
    const db = getServiceClient()
    const { data, error } = await db
      .from('vans')
      .select(
        'id, instance, display_name, trust_id, status, speed_floor, modality_target, trusts ( id, name, slug )',
      )
      .neq('status', 'removed')
    if (error) throw error
    return (data ?? []) as unknown as DbVanRow[]
  } catch {
    return []
  }
}

async function autoDiscover(instances: string[], existing: DbVanRow[]) {
  if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) return
  const known = new Set(existing.map((van) => van.instance))
  const missing = instances.filter(
    (instance) => !known.has(instance) && !isHubInstance(instance),
  )
  if (!missing.length) return

  const db = getServiceClient()
  await db.from('vans').upsert(
    missing.map((instance) => ({
      instance,
      display_name: instance,
      status: 'unassigned' as const,
      daily_enabled: false,
      weekly_enabled: false,
    })),
    { onConflict: 'instance', ignoreDuplicates: true },
  )
}

export async function buildFleetPayload(): Promise<FleetPayload> {
  const cached = getFleetCache()
  if (cached && isFleetCacheFresh(cached.ageMs)) {
    return { ...cached.payload, source: 'cache', stale: false }
  }

  const thresholds = await loadThresholds()
  let vans = await loadVans()
  const fetchedAt = new Date().toISOString()

  try {
    const useFixtures = !grafana.token()
    const samples = useFixtures ? fixtureSamples() : await fetchAllFleetSamples()

    const instances = new Set<string>()
    for (const list of Object.values(samples) as Array<{ metric: { instance?: string } }[] | undefined>) {
      for (const sample of list ?? []) {
        if (sample.metric.instance) instances.add(sample.metric.instance)
      }
    }
    await autoDiscover([...instances], vans)
    vans = await loadVans()

    const payload = mergeFleetMetrics({
      samples,
      vans,
      thresholds,
      fetchedAt,
      stale: false,
      source: useFixtures ? 'fixture' : 'grafana',
    })
    setFleetCache(payload)
    return payload
  } catch (error) {
    if (cached) {
      return {
        ...cached.payload,
        stale: true,
        source: 'cache',
        fetchedAt: cached.payload.fetchedAt,
      }
    }

    // Last resort: fixture so the UI can still render
    const payload = mergeFleetMetrics({
      samples: fixtureSamples(),
      vans,
      thresholds,
      fetchedAt,
      stale: true,
      source: 'fixture',
    })
    // Attach error reason on a synthetic green check — UI uses stale banner
    void error
    setFleetCache(payload)
    return payload
  }
}

export { deriveStatus } from './deriveStatus.js'
