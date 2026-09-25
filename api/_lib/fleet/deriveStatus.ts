import {
  DEFAULT_FLEET_THRESHOLDS,
  type DeriveStatusInput,
  type DeriveStatusResult,
  type FleetThresholds,
} from './types.js'

function num(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * First-match status rules from Technical Scope §5.
 * Pure — no I/O. Unit-test this thoroughly.
 */
export function deriveStatus(input: DeriveStatusInput): DeriveStatusResult {
  const { metrics } = input
  const thresholds: FleetThresholds = {
    ...DEFAULT_FLEET_THRESHOLDS,
    ...input.thresholds,
  }
  const now = input.now ?? new Date()

  const modality = num(metrics.modality_up)
  const syncDest = num(metrics.sync_dest_up)
  const scrapeUp = num(metrics.scrape_up)
  const patients = num(metrics.patients_today) ?? 0
  const worklist = num(metrics.worklist_today) ?? 0
  const failed = num(metrics.sync_failed) ?? 0
  const retry = num(metrics.sync_retry) ?? 0
  const speed = num(metrics.sync_speed)
  const floor = num(metrics.speed_floor) ?? thresholds.speed_floor_mbps

  // Red: Offline
  // probe_success: 1 = OK. deos_*_status gauges: 0 = OK, non-zero = error code.
  if (modality === 0) {
    return { status: 'red', reason: 'modality_up = 0' }
  }
  if (syncDest != null && syncDest !== 0) {
    return { status: 'red', reason: `sync_dest_up = ${syncDest}` }
  }
  if (scrapeUp === 0) {
    return { status: 'red', reason: 'scrape_up = 0' }
  }
  if (metrics.scraped_at != null) {
    const staleMs = thresholds.scrape_stale_minutes * 60_000
    if (now.getTime() - metrics.scraped_at > staleMs) {
      return {
        status: 'red',
        reason: `no scrape data for ${thresholds.scrape_stale_minutes}+ minutes`,
      }
    }
  } else if (
    scrapeUp == null &&
    modality == null &&
    syncDest == null &&
    speed == null &&
    num(metrics.db_up) == null
  ) {
    return { status: 'red', reason: 'no scrape data' }
  }

  // Grey: Not scheduled
  if (worklist === 0 && patients === 0) {
    return { status: 'grey', reason: 'worklist_today = 0 and patients_today = 0' }
  }

  // Amber: Degraded
  if (failed >= thresholds.failed_queue_amber) {
    return {
      status: 'amber',
      reason: `sync_failed ${failed} >= ${thresholds.failed_queue_amber}`,
    }
  }
  if (retry >= thresholds.retry_queue_amber) {
    return {
      status: 'amber',
      reason: `sync_retry ${retry} >= ${thresholds.retry_queue_amber}`,
    }
  }
  if (speed != null && speed < floor) {
    return {
      status: 'amber',
      reason: `sync_speed ${speed.toFixed(2)} MB/s below floor ${floor}`,
    }
  }

  const hour = now.getHours()
  if (hour >= 12 && worklist > 0) {
    const progressPct = (patients / worklist) * 100
    if (progressPct < thresholds.progress_amber_pct) {
      return {
        status: 'amber',
        reason: `progress ${progressPct.toFixed(0)}% below ${thresholds.progress_amber_pct}% after midday`,
      }
    }
  }

  return { status: 'green', reason: 'online' }
}
