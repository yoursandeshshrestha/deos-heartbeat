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
    return { status: 'red', reason: 'The scanner is not responding' }
  }
  if (syncDest != null && syncDest !== 0) {
    return { status: 'red', reason: 'Images are not reaching the hospital' }
  }
  if (scrapeUp === 0) {
    return { status: 'red', reason: 'This van stopped sending updates' }
  }
  if (metrics.scraped_at != null) {
    const staleMs = thresholds.scrape_stale_minutes * 60_000
    if (now.getTime() - metrics.scraped_at > staleMs) {
      return {
        status: 'red',
        reason: `No update from this van for over ${thresholds.scrape_stale_minutes} minutes`,
      }
    }
  } else if (
    scrapeUp == null &&
    modality == null &&
    syncDest == null &&
    speed == null &&
    num(metrics.db_up) == null
  ) {
    return { status: 'red', reason: 'No update from this van' }
  }

  // Grey: Not scheduled
  if (worklist === 0 && patients === 0) {
    return { status: 'grey', reason: 'Nothing is scheduled today' }
  }

  // Amber: Degraded
  if (failed >= thresholds.failed_queue_amber) {
    const sends = failed === 1 ? 'send has' : 'sends have'
    return {
      status: 'amber',
      reason: `${failed} image ${sends} failed`,
    }
  }
  if (retry >= thresholds.retry_queue_amber) {
    const sends = retry === 1 ? 'send is' : 'sends are'
    return {
      status: 'amber',
      reason: `${retry} image ${sends} waiting to try again`,
    }
  }
  if (speed != null && speed < floor) {
    return {
      status: 'amber',
      reason: 'Image transfer is slower than usual',
    }
  }

  const hour = now.getHours()
  if (hour >= 12 && worklist > 0) {
    const progressPct = (patients / worklist) * 100
    if (progressPct < thresholds.progress_amber_pct) {
      return {
        status: 'amber',
        reason: `Only ${progressPct.toFixed(0)}% of today's patients are done`,
      }
    }
  }

  return { status: 'green', reason: 'Running normally' }
}
