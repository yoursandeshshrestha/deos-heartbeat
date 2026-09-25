import { grafana, supabase as supabaseEnv } from '../env.js'
import { getServiceClient } from '../supabase.js'
import { getFleetCache, isFleetCacheFresh, setFleetCache } from './cache.js'
import { fixtureSamples } from './fixtures.js'
import { mergeFleetMetrics, type DbVanRow } from './merge.js'
import {
  displayNameFromInstance,
  isExcludedInstance,
  trustSlugFromInstance,
} from './queries.js'
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

async function ensureTrustId(slug: string): Promise<string | null> {
  const db = getServiceClient()
  const { data: existing } = await db
    .from('trusts')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const name = slug
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  const { data: created, error } = await db
    .from('trusts')
    .insert({
      name,
      slug,
      active: true,
      daily_enabled: true,
      weekly_enabled: true,
    })
    .select('id')
    .single()

  if (error) {
    const { data: again } = await db
      .from('trusts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    return (again?.id as string) ?? null
  }
  return (created?.id as string) ?? null
}

async function autoDiscover(instances: string[], existing: DbVanRow[]) {
  if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) return
  const db = getServiceClient()

  const excludedIds = existing
    .filter((van) => isExcludedInstance(van.instance) && van.status !== 'removed')
    .map((van) => van.id)
  if (excludedIds.length) {
    await db.from('vans').update({ status: 'removed' }).in('id', excludedIds)
  }

  const needsBackfill = existing.filter(
    (van) =>
      van.status === 'unassigned' &&
      !isExcludedInstance(van.instance) &&
      (!van.trust_id ||
        van.display_name === van.instance ||
        !van.modality_target),
  )

  const trustIds = new Map<string, string | null>()
  async function trustFor(instance: string) {
    const slug = trustSlugFromInstance(instance)
    if (!trustIds.has(slug)) {
      trustIds.set(slug, await ensureTrustId(slug))
    }
    return trustIds.get(slug) ?? null
  }

  for (const van of needsBackfill) {
    await db
      .from('vans')
      .update({
        trust_id: van.trust_id ?? (await trustFor(van.instance)),
        display_name:
          van.display_name === van.instance
            ? displayNameFromInstance(van.instance)
            : van.display_name,
        modality_target: van.modality_target ?? van.instance,
      })
      .eq('id', van.id)
  }

  const known = new Set(existing.map((van) => van.instance))
  const missing = instances.filter(
    (instance) => !known.has(instance) && !isExcludedInstance(instance),
  )
  if (!missing.length) return

  for (const instance of missing) {
    await trustFor(instance)
  }

  await db.from('vans').upsert(
    missing.map((instance) => {
      const slug = trustSlugFromInstance(instance)
      return {
        instance,
        display_name: displayNameFromInstance(instance),
        modality_target: instance,
        trust_id: trustIds.get(slug) ?? null,
        status: 'unassigned' as const,
        daily_enabled: false,
        weekly_enabled: false,
      }
    }),
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
    for (const list of Object.values(samples) as Array<
      { metric: { instance?: string } }[] | undefined
    >) {
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

    const payload = mergeFleetMetrics({
      samples: fixtureSamples(),
      vans,
      thresholds,
      fetchedAt,
      stale: true,
      source: 'fixture',
    })
    void error
    setFleetCache(payload)
    return payload
  }
}

export { deriveStatus } from './deriveStatus.js'
