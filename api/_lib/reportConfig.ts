export type ReportConfigVanInput = {
  id: string
  instance: string
  display_name: string
  daily_enabled: boolean
  weekly_enabled: boolean
  status: string
}

export type ReportConfigRecipientInput = {
  id: string
  name: string
  email: string
  active: boolean
}

export type ReportConfigTrustInput = {
  id: string
  name: string
  slug: string
  daily_enabled: boolean
  weekly_enabled: boolean
  active: boolean
  vans?: ReportConfigVanInput[] | null
  recipients?: ReportConfigRecipientInput[] | null
}

/** Pure filter used by GET /api/report-config. */
export function filterReportConfigTrusts(trusts: ReportConfigTrustInput[]) {
  return trusts
    .filter((trust) => trust.active)
    .map((trust) => ({
      id: trust.id,
      name: trust.name,
      slug: trust.slug,
      daily_enabled: trust.daily_enabled,
      weekly_enabled: trust.weekly_enabled,
      vans: (trust.vans ?? [])
        .filter((van) => van.status === 'active')
        .map((van) => ({
          id: van.id,
          instance: van.instance,
          display_name: van.display_name,
          daily_enabled: van.daily_enabled,
          weekly_enabled: van.weekly_enabled,
        })),
      recipients: (trust.recipients ?? [])
        .filter((recipient) => recipient.active)
        .map((recipient) => ({
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
        })),
    }))
}
