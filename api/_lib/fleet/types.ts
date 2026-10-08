export type FleetStatus = 'red' | 'grey' | 'amber' | 'green'

export type FleetThresholds = {
  speed_floor_mbps: number
  failed_queue_amber: number
  retry_queue_amber: number
  progress_amber_pct: number
  scrape_stale_minutes: number
}

export const DEFAULT_FLEET_THRESHOLDS: FleetThresholds = {
  speed_floor_mbps: 0.25,
  failed_queue_amber: 3,
  retry_queue_amber: 5,
  progress_amber_pct: 40,
  scrape_stale_minutes: 10,
}

export type VanMetrics = {
  instance: string
  trust: string | null
  modality_up: number | null
  sync_dest_up: number | null
  patients_today: number | null
  studies_today: number | null
  worklist_today: number | null
  sync_speed: number | null
  sync_failed: number | null
  sync_active: number | null
  sync_complete: number | null
  sync_retry: number | null
  db_up: number | null
  orthanc_up: number | null
  version: string | null
  scrape_up: number | null
  /** Epoch ms of last successful scrape, if known */
  scraped_at: number | null
  speed_floor: number | null
  latitude: number | null
  longitude: number | null
  /** Metres. Null when the modem did not report a fix quality. */
  gps_accuracy: number | null
}

export type DeriveStatusInput = {
  metrics: VanMetrics
  thresholds: FleetThresholds
  /** Wall clock for "after 12:00" amber progress rule */
  now?: Date
}

export type DeriveStatusResult = {
  status: FleetStatus
  reason: string
}

export type FleetVan = VanMetrics & {
  id: string | null
  display_name: string
  status: FleetStatus
  reason: string
  van_status: 'active' | 'paused' | 'unassigned' | 'removed' | null
  gps_source: 'live' | 'last_known' | null
  gps_recorded_at: string | null
}

export type FleetTrustGroup = {
  trust: string
  trust_id: string | null
  vans: FleetVan[]
  counts: Record<FleetStatus, number>
}

export type FleetPayload = {
  fetchedAt: string
  stale: boolean
  thresholds: FleetThresholds
  trusts: FleetTrustGroup[]
  vans: FleetVan[]
  source: 'grafana' | 'fixture' | 'cache'
}
