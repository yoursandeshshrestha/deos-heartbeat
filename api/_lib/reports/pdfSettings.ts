export type ReportPdfSettings = {
  /** Total studies transferred */
  studies: boolean
  /** Average transfer speed */
  transfer_speed: boolean
  /** Start and end time the modality was connected */
  modality_window: boolean
  /** Sum of studies across the week (weekly PDF only) */
  week_total: boolean
}

export const DEFAULT_REPORT_PDF_SETTINGS: ReportPdfSettings = {
  studies: true,
  transfer_speed: true,
  modality_window: true,
  week_total: true,
}

const KEYS = Object.keys(DEFAULT_REPORT_PDF_SETTINGS) as Array<
  keyof ReportPdfSettings
>

export function parseReportPdfSettings(value: unknown): ReportPdfSettings {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const settings = { ...DEFAULT_REPORT_PDF_SETTINGS }
  for (const key of KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key]
  }
  return settings
}

/** At least one figure must stay on, otherwise the PDF has nothing to show. */
export function hasVisiblePdfFigure(
  settings: ReportPdfSettings,
  reportType: 'daily' | 'weekly',
) {
  if (settings.studies || settings.transfer_speed || settings.modality_window) {
    return true
  }
  return reportType === 'weekly' && settings.week_total
}
