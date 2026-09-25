export type FleetStatus = 'red' | 'grey' | 'amber' | 'green'

export type FleetVan = {
  id: string | null
  instance: string
  trust: string | null
  display_name: string
  status: FleetStatus
  reason: string
  van_status: 'active' | 'paused' | 'unassigned' | 'removed' | null
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
  scraped_at: number | null
  speed_floor: number | null
}

export type FleetTrustGroup = {
  trust: string
  trust_id: string | null
  vans: FleetVan[]
  counts: Record<FleetStatus, number>
}

export type FleetThresholds = {
  speed_floor_mbps: number
  failed_queue_amber: number
  retry_queue_amber: number
  progress_amber_pct: number
  scrape_stale_minutes: number
}

export type FleetPayload = {
  fetchedAt: string
  stale: boolean
  thresholds: FleetThresholds
  trusts: FleetTrustGroup[]
  vans: FleetVan[]
  source: 'grafana' | 'fixture' | 'cache'
}
