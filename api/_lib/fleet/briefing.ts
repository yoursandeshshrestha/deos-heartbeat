import type { FleetPayload, FleetStatus, FleetVan } from '../fleet/types.js'

export type FleetBriefingFacts = {
  fetchedAt: string
  trustFilter: string | null
  vans: number
  trusts: number
  counts: Record<FleetStatus, number>
  patients: number
  studies: number
  worklist: number
  progressPct: number | null
  failed: number
  retry: number
  active: number
  avgSpeedMbps: number | null
  offline: Array<{ trust: string; name: string }>
  degraded: Array<{ trust: string; name: string; reason: string }>
  notScheduled: number
}

export type FleetBriefingResult = {
  summary: string
}

function sumMetric(vans: FleetVan[], key: keyof FleetVan) {
  return vans.reduce((total, van) => {
    const value = van[key]
    return typeof value === 'number' && Number.isFinite(value) ? total + value : total
  }, 0)
}

function titleCaseTrust(slug: string) {
  return slug
    .split('_')
    .map((part) =>
      part.length <= 3
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ')
}

function firstName(name?: string | null) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export function buildFleetBriefingFacts(
  fleet: FleetPayload,
  trustFilter?: string | null,
): FleetBriefingFacts {
  const trusts =
    trustFilter && trustFilter !== 'all'
      ? fleet.trusts.filter((group) => group.trust === trustFilter)
      : fleet.trusts
  const vans = trusts.flatMap((group) => group.vans)

  const counts: Record<FleetStatus, number> = {
    red: 0,
    amber: 0,
    grey: 0,
    green: 0,
  }
  for (const van of vans) counts[van.status] += 1

  const patients = sumMetric(vans, 'patients_today')
  const studies = sumMetric(vans, 'studies_today')
  const worklist = sumMetric(vans, 'worklist_today')
  const failed = sumMetric(vans, 'sync_failed')
  const retry = sumMetric(vans, 'sync_retry')
  const active = sumMetric(vans, 'sync_active')
  const speeds = vans
    .map((van) => van.sync_speed)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const avgSpeedMbps =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null

  const trustByInstance = new Map(
    trusts.flatMap((group) =>
      group.vans.map((van) => [van.instance, group.trust] as const),
    ),
  )

  const offline = vans
    .filter((van) => van.status === 'red')
    .slice(0, 12)
    .map((van) => ({
      trust: van.trust || trustByInstance.get(van.instance) || 'unknown',
      name: van.display_name || van.instance,
    }))

  const degraded = vans
    .filter((van) => van.status === 'amber')
    .slice(0, 12)
    .map((van) => ({
      trust: van.trust || trustByInstance.get(van.instance) || 'unknown',
      name: van.display_name || van.instance,
      reason: van.reason || 'behind or slow',
    }))

  return {
    fetchedAt: fleet.fetchedAt,
    trustFilter:
      trustFilter && trustFilter !== 'all' ? trustFilter : null,
    vans: vans.length,
    trusts: trusts.length,
    counts,
    patients,
    studies,
    worklist,
    progressPct: worklist > 0 ? (patients / worklist) * 100 : null,
    failed,
    retry,
    active,
    avgSpeedMbps,
    offline,
    degraded,
    notScheduled: counts.grey,
  }
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** Casual fleet briefing from live counts (no AI). */
export function buildFleetBriefing(
  facts: FleetBriefingFacts,
  viewerName?: string | null,
): FleetBriefingResult {
  const hello = firstName(viewerName)
  const greeting = hello ? `Hey ${hello}` : 'Hey'

  if (facts.vans === 0) {
    return {
      summary: `${greeting}, there are no vans in this view yet. Once vans are assigned to trusts, their health will show here.`,
    }
  }

  const scope = facts.trustFilter
    ? `for ${titleCaseTrust(facts.trustFilter)}`
    : `across ${facts.trusts} trusts`

  const parts: string[] = []
  parts.push(
    `${greeting}, out of ${facts.vans} vans ${scope}, ${facts.counts.green} ${facts.counts.green === 1 ? 'is' : 'are'} online, ${facts.counts.amber} ${facts.counts.amber === 1 ? 'is' : 'are'} behind or slow, ${facts.counts.red} ${facts.counts.red === 1 ? 'is' : 'are'} offline, and ${facts.counts.grey} ${facts.counts.grey === 1 ? "isn't" : "aren't"} scheduled.`,
  )

  if (facts.worklist > 0) {
    const pct = facts.progressPct == null ? null : Math.round(facts.progressPct)
    parts.push(
      pct == null
        ? `We've completed ${facts.patients} of ${facts.worklist} planned patients so far.`
        : `Patient progress is ${pct}% — we've completed ${facts.patients} out of ${facts.worklist} planned patients so far.`,
    )
  } else if (facts.patients > 0) {
    parts.push(
      `We've seen ${plural(facts.patients, 'patient', 'patients')} so far, but the planned list size isn't available for this view.`,
    )
  }

  if (facts.failed > 0 || facts.retry > 5) {
    parts.push(
      `On image sending, ${plural(facts.failed, 'send has', 'sends have')} failed and ${facts.retry} ${facts.retry === 1 ? 'is' : 'are'} waiting to try again.`,
    )
  }

  return {
    summary: parts.join(' '),
  }
}

type CacheEntry = FleetBriefingResult & { at: number }
const cache = new Map<string, CacheEntry>()
const CACHE_MS = 3 * 60_000

export function briefingCacheKey(
  facts: FleetBriefingFacts,
  viewerName?: string | null,
) {
  return [
    'v8',
    firstName(viewerName) ?? 'anon',
    facts.trustFilter ?? 'all',
    facts.vans,
    facts.counts.red,
    facts.counts.amber,
    facts.counts.grey,
    facts.counts.green,
    facts.patients,
    facts.worklist,
    facts.failed,
    facts.retry,
  ].join('|')
}

export function getCachedBriefing(key: string): FleetBriefingResult | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key)
    return null
  }
  const { at: _at, ...rest } = hit
  return rest
}

export function setCachedBriefing(key: string, entry: FleetBriefingResult) {
  cache.set(key, { ...entry, at: Date.now() })
}
