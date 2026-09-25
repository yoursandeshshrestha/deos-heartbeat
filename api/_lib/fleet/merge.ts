import { deriveStatus } from './deriveStatus.js'
import {
  isExcludedInstance,
  type FleetMetricKey,
  type PromSample,
  parsePromValue,
} from './queries.js'
import type {
  FleetPayload,
  FleetThresholds,
  FleetTrustGroup,
  FleetVan,
  VanMetrics,
} from './types.js'

export type DbVanRow = {
  id: string
  instance: string
  display_name: string
  trust_id: string | null
  status: 'active' | 'paused' | 'unassigned' | 'removed'
  speed_floor: string | null
  modality_target: string | null
  trusts: { id: string; name: string; slug: string } | null
}

type MetricMap = Partial<Record<FleetMetricKey, PromSample[]>>

function emptyMetrics(instance: string, trust: string | null): VanMetrics {
  return {
    instance,
    trust,
    modality_up: null,
    sync_dest_up: null,
    patients_today: null,
    studies_today: null,
    worklist_today: null,
    sync_speed: null,
    sync_failed: null,
    sync_active: null,
    sync_complete: null,
    sync_retry: null,
    db_up: null,
    orthanc_up: null,
    version: null,
    scrape_up: null,
    scraped_at: null,
    speed_floor: null,
  }
}

function trustFromLabels(sample: PromSample): string | null {
  return sample.metric.trust || sample.metric.instance?.split('.')[0] || null
}

/**
 * Merge PromQL instant results by Prometheus instance label.
 * modality may use modality_target as the instance key — remap via db vans.
 */
export function mergeFleetMetrics(args: {
  samples: MetricMap
  vans: DbVanRow[]
  thresholds: FleetThresholds
  fetchedAt: string
  stale: boolean
  source: FleetPayload['source']
}): FleetPayload {
  const byInstance = new Map<string, VanMetrics>()
  const modalityTargetToInstance = new Map<string, string>()

  for (const van of args.vans) {
    if (van.modality_target) {
      modalityTargetToInstance.set(van.modality_target, van.instance)
    }
  }

  for (const [key, list] of Object.entries(args.samples) as Array<
    [FleetMetricKey, PromSample[] | undefined]
  >) {
    for (const sample of list ?? []) {
      let instance = sample.metric.instance
      if (!instance) continue

      if (key === 'modality_up') {
        instance = modalityTargetToInstance.get(instance) ?? instance
      }

      if (isExcludedInstance(instance)) continue

      const existing = byInstance.get(instance) ?? emptyMetrics(instance, trustFromLabels(sample))
      if (!existing.trust) existing.trust = trustFromLabels(sample)

      if (key === 'version') {
        existing.version =
          sample.metric.version ||
          sample.metric.deos_version ||
          sample.value[1] ||
          existing.version
      } else if (key === 'scrape_up') {
        existing.scrape_up = parsePromValue(sample.value[1])
        existing.scraped_at = sample.value[0] * 1000
      } else if (key === 'sync_dest_up') {
        // Multiple destinations per instance (label `name`); keep worst non-zero code.
        const next = parsePromValue(sample.value[1])
        if (next != null) {
          const prev = existing.sync_dest_up
          existing.sync_dest_up =
            prev == null ? next : Math.abs(next) >= Math.abs(prev) ? next : prev
        }
      } else {
        existing[key] = parsePromValue(sample.value[1]) as never
      }

      byInstance.set(instance, existing)
    }
  }

  // Ensure DB vans appear even if Grafana returned nothing for them
  for (const van of args.vans) {
    if (van.status === 'removed' || isExcludedInstance(van.instance)) continue
    if (!byInstance.has(van.instance)) {
      byInstance.set(
        van.instance,
        emptyMetrics(van.instance, van.trusts?.slug ?? van.trusts?.name ?? null),
      )
    }
  }

  const vanByInstance = new Map(args.vans.map((van) => [van.instance, van]))
  const fleetVans: FleetVan[] = []

  for (const metrics of byInstance.values()) {
    const dbVan = vanByInstance.get(metrics.instance)
    const speedFloor = dbVan?.speed_floor != null ? Number(dbVan.speed_floor) : null
    const withFloor: VanMetrics = {
      ...metrics,
      trust: dbVan?.trusts?.slug ?? metrics.trust,
      speed_floor: Number.isFinite(speedFloor) ? speedFloor : null,
    }
    const derived = deriveStatus({ metrics: withFloor, thresholds: args.thresholds })
    fleetVans.push({
      ...withFloor,
      id: dbVan?.id ?? null,
      display_name: dbVan?.display_name ?? metrics.instance,
      status: derived.status,
      reason: derived.reason,
      van_status: dbVan?.status ?? null,
    })
  }

  fleetVans.sort((a, b) => a.display_name.localeCompare(b.display_name))

  const trustMap = new Map<string, FleetTrustGroup>()
  for (const van of fleetVans) {
    const trustKey = van.trust || 'unassigned'
    const dbVan = vanByInstance.get(van.instance)
    let group = trustMap.get(trustKey)
    if (!group) {
      group = {
        trust: trustKey,
        trust_id: dbVan?.trust_id ?? null,
        vans: [],
        counts: { red: 0, grey: 0, amber: 0, green: 0 },
      }
      trustMap.set(trustKey, group)
    }
    group.vans.push(van)
    group.counts[van.status] += 1
  }

  const trusts = [...trustMap.values()].sort((a, b) => a.trust.localeCompare(b.trust))

  return {
    fetchedAt: args.fetchedAt,
    stale: args.stale,
    thresholds: args.thresholds,
    trusts,
    vans: fleetVans,
    source: args.source,
  }
}
