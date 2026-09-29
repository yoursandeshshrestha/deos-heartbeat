export const FLEET_QUERIES = {
  modality_up: 'probe_success{job="modality"}',
  sync_dest_up: 'deos_sync_destination_status',
  patients_today: 'orthanc_number_of_patients_today',
  studies_today: 'orthanc_number_of_studies_today',
  worklist_today: 'deos_worklist_today_count',
  sync_speed: 'avg_over_time(deos_sync_transfer_speed[15m])',
  sync_failed: 'deos_sync_queue_failed_count',
  sync_active: 'deos_sync_queue_active_count',
  sync_complete: 'deos_sync_queue_complete_count',
  sync_retry: 'deos_sync_queue_retry_count',
  db_up: 'deos_db_status',
  orthanc_up: 'deos_orthanc_status',
  version: 'deos_version',
  scrape_up: 'up',
  latitude: 'snmp_latitude',
  longitude: 'snmp_longitude',
} as const

export type FleetMetricKey = keyof typeof FLEET_QUERIES

export type PromSample = {
  metric: Record<string, string>
  value: [number, string]
}

/** Non-screening instances: hubs, routers, xray-mob (scope open Q5). */
export function isExcludedInstance(instance: string) {
  const lower = instance.toLowerCase()
  // Seed / fixture leftovers — never treat as real fleet
  if (lower.startsWith('demo.') || lower.startsWith('fixture.')) return true
  // hubs / secondary servers
  if (lower.includes('dserver') || lower.endsWith('.vserver')) return true
  // e.g. trust.van.router / trust.van.router2
  if (/(^|\.)router\d*$/.test(lower)) return true
  if (lower.includes('xray-mob')) return true
  return false
}

/** @deprecated use isExcludedInstance */
export function isHubInstance(instance: string) {
  return isExcludedInstance(instance)
}

export function trustSlugFromInstance(instance: string) {
  const prefix = instance.split('.')[0]
  return prefix || 'unknown'
}

export function displayNameFromInstance(instance: string) {
  const parts = instance.split('.')
  if (parts.length < 2) return instance
  return parts.slice(1).join('.').replace(/_/g, ' ')
}

export function parsePromValue(raw: string): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
