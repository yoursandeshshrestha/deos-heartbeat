import { getServiceClient } from '../supabase.js'
import type { ReportType } from './buildTrustReport.js'
import type { VanPerformance } from './performance.js'

const BUCKET = 'generated-reports'

export function reportPeriod(reportType: ReportType, vans: VanPerformance[]) {
  const days = vans[0]?.days ?? []
  const start = days[0]
  const end = days[days.length - 1]
  const periodStart = start?.date ?? null
  const periodEnd = end?.date ?? periodStart
  const periodLabel =
    reportType === 'weekly' && start && end
      ? `${start.label} – ${end.label}`
      : (start?.label ?? '')

  return { periodStart, periodEnd, periodLabel }
}

export function safeReportFilename(name: string) {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'report.pdf'
}

export async function storeGeneratedReport(input: {
  trustId: string
  reportType: ReportType
  filename: string
  pdf: Uint8Array
  periodStart: string | null
  periodEnd: string | null
  periodLabel: string
}) {
  const db = getServiceClient()
  const id = crypto.randomUUID()
  const storagePath = `${input.trustId}/${input.reportType}/${input.periodStart ?? 'undated'}-${id}.pdf`

  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, input.pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const filename = safeReportFilename(input.filename)
  const { error } = await db.from('generated_reports').insert({
    id,
    trust_id: input.trustId,
    report_type: input.reportType,
    filename,
    storage_path: storagePath,
    period_label: input.periodLabel,
    period_start: input.periodStart,
    period_end: input.periodEnd,
  })
  if (error) {
    await db.storage.from(BUCKET).remove([storagePath])
    throw new Error(error.message)
  }

  return { id, filename, storagePath }
}

/** Link anyone in the Slack channel can open. Expires after 7 days. */
export async function signedReportPdfUrl(storagePath: string) {
  const db = getServiceClient()
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function readGeneratedReportPdf(
  id: string,
): Promise<{ filename: string; bytes: Uint8Array } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const db = getServiceClient()
  const { data: row, error } = await db
    .from('generated_reports')
    .select('filename, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (error || !row?.storage_path) return null

  const { data, error: downloadError } = await db.storage.from(BUCKET).download(row.storage_path)
  if (downloadError || !data) return null

  return {
    filename: safeReportFilename(String(row.filename ?? 'report.pdf')),
    bytes: new Uint8Array(await data.arrayBuffer()),
  }
}
