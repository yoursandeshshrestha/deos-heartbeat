import type { FleetVan } from '../fleet/types.js'

export type ReportType = 'daily' | 'weekly'

export type TrustReportVanConfig = {
  id: string
  instance: string
  display_name: string
  modality_target?: string | null
  daily_enabled: boolean
  weekly_enabled: boolean
  status: string
}

export type TrustReportRecipient = {
  id: string
  name: string
  email: string
  active: boolean
}

export type TrustReportConfig = {
  id: string
  name: string
  slug: string
  daily_enabled: boolean
  weekly_enabled: boolean
  active: boolean
  vans: TrustReportVanConfig[]
  recipients: TrustReportRecipient[]
}

export type TrustReportRow = {
  vanId: string
  instance: string
  displayName: string
  status: FleetVan['status'] | 'unknown'
  reason: string
  patientsToday: number | null
  worklistToday: number | null
  syncSpeedMbps: number | null
  syncFailed: number | null
  syncRetry: number | null
  syncActive: number | null
}

export type TrustReport = {
  trustId: string
  trustName: string
  trustSlug: string
  reportType: ReportType
  recipients: { id: string; name: string; email: string }[]
  rows: TrustReportRow[]
  generatedAt: string
}

function vanEnabledForType(van: TrustReportVanConfig, reportType: ReportType) {
  return reportType === 'daily' ? van.daily_enabled : van.weekly_enabled
}

function trustEnabledForType(trust: TrustReportConfig, reportType: ReportType) {
  return reportType === 'daily' ? trust.daily_enabled : trust.weekly_enabled
}

/** Whether this trust should receive a report of the given type. */
export function isTrustEligible(
  trust: TrustReportConfig,
  reportType: ReportType,
): { ok: true } | { ok: false; reason: string } {
  if (!trust.active) return { ok: false, reason: 'trust inactive' }
  if (!trustEnabledForType(trust, reportType)) {
    return { ok: false, reason: `${reportType} disabled on trust` }
  }

  const recipients = trust.recipients.filter((r) => r.active && r.email)
  if (!recipients.length) return { ok: false, reason: 'no recipients' }

  const vans = trust.vans.filter(
    (van) => van.status === 'active' && vanEnabledForType(van, reportType),
  )
  if (!vans.length) return { ok: false, reason: 'no included vans' }

  return { ok: true }
}

/**
 * Join trust config vans with live fleet metrics by instance.
 * Only active vans with the matching daily/weekly flag are included.
 */
export function buildTrustReport(input: {
  trust: TrustReportConfig
  reportType: ReportType
  fleetVans: FleetVan[]
  generatedAt?: string
}): TrustReport | null {
  const { trust, reportType, fleetVans } = input
  const eligible = isTrustEligible(trust, reportType)
  if (!eligible.ok) return null

  const byInstance = new Map(fleetVans.map((van) => [van.instance, van]))
  const included = trust.vans.filter(
    (van) => van.status === 'active' && vanEnabledForType(van, reportType),
  )

  const rows: TrustReportRow[] = included.map((van) => {
    const fleet = byInstance.get(van.instance)
    return {
      vanId: van.id,
      instance: van.instance,
      displayName: van.display_name || fleet?.display_name || van.instance,
      status: fleet?.status ?? 'unknown',
      reason: fleet?.reason ?? 'No live metrics',
      patientsToday: fleet?.patients_today ?? null,
      worklistToday: fleet?.worklist_today ?? null,
      syncSpeedMbps: fleet?.sync_speed ?? null,
      syncFailed: fleet?.sync_failed ?? null,
      syncRetry: fleet?.sync_retry ?? null,
      syncActive: fleet?.sync_active ?? null,
    }
  })

  return {
    trustId: trust.id,
    trustName: trust.name,
    trustSlug: trust.slug,
    reportType,
    recipients: trust.recipients
      .filter((r) => r.active && r.email)
      .map((r) => ({ id: r.id, name: r.name, email: r.email })),
    rows,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  }
}
