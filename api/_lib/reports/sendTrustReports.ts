import { buildFleetPayload } from '../fleet/build.js'
import { sendEmail } from '../email/resend.js'
import { getServiceClient } from '../supabase.js'
import {
  buildTrustReport,
  isTrustEligible,
  type ReportType,
  type TrustReportConfig,
  type TrustReportVanConfig,
} from './buildTrustReport.js'
import { loadReportPerformance, type PerformanceVanInput } from './performance.js'
import {
  parseReportPdfSettings,
  type ReportPdfSettings,
} from './pdfSettings.js'
import {
  performancePdfFilename,
  renderPerformancePdf,
} from './renderPerformancePdf.js'
import { renderTrustEmail, reportSubject } from './renderTrustEmail.js'
import { notifyReportsSent, type SlackReportItem } from './slackNotify.js'
import {
  reportPeriod,
  signedReportPdfUrl,
  storeGeneratedReport,
} from './storeGeneratedReport.js'

export type SendTrustReportsInput = {
  reportType: ReportType
  trustId?: string
  dryRun?: boolean
}

export type SendTrustReportsResult = {
  report_type: ReportType
  dry_run: boolean
  sent: number
  failed: number
  skipped: number
  results: Array<{
    trust_id: string
    trust_name: string
    status: 'sent' | 'failed' | 'skipped' | 'dry_run'
    reason?: string
    recipients?: number
  }>
}

async function loadTrustConfigs(trustId?: string): Promise<TrustReportConfig[]> {
  const db = getServiceClient()
  let query = db
    .from('trusts')
    .select(
      `
      id,
      name,
      slug,
      daily_enabled,
      weekly_enabled,
      active,
      vans (
        id,
        instance,
        display_name,
        modality_target,
        daily_enabled,
        weekly_enabled,
        status
      ),
      recipients (
        id,
        name,
        email,
        active
      )
    `,
    )
    .order('name', { ascending: true })

  if (trustId) {
    query = query.eq('id', trustId)
  } else {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TrustReportConfig[]
}

async function loadPdfSettings(): Promise<ReportPdfSettings> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'report_pdf')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return parseReportPdfSettings(data?.value)
}

function performanceVans(
  vans: TrustReportVanConfig[],
  fleetByInstance: Map<string, { studies_today: number | null; sync_speed: number | null }>,
  reportType: ReportType,
): PerformanceVanInput[] {
  return vans
    .filter((van) => {
      if (van.status !== 'active') return false
      return reportType === 'daily' ? van.daily_enabled : van.weekly_enabled
    })
    .map((van) => {
      const fleet = fleetByInstance.get(van.instance)
      return {
        instance: van.instance,
        displayName: van.display_name || van.instance,
        modalityTarget: van.modality_target ?? null,
        studiesToday: fleet?.studies_today ?? null,
        syncSpeedMbps: fleet?.sync_speed ?? null,
      }
    })
}

/** Build, send (or dry-run), and record report_runs for eligible trusts. */
export async function sendTrustReports(
  input: SendTrustReportsInput,
): Promise<SendTrustReportsResult> {
  const { reportType, trustId, dryRun = false } = input
  const [trusts, fleet, fields] = await Promise.all([
    loadTrustConfigs(trustId),
    buildFleetPayload(),
    loadPdfSettings(),
  ])

  if (trustId && !trusts.length) {
    throw new Error('trust not found')
  }

  const db = getServiceClient()
  const slackItems: SlackReportItem[] = []
  const summary: SendTrustReportsResult = {
    report_type: reportType,
    dry_run: dryRun,
    sent: 0,
    failed: 0,
    skipped: 0,
    results: [],
  }

  for (const trust of trusts) {
    const eligible = isTrustEligible(trust, reportType)
    if (eligible.ok === false) {
      summary.skipped += 1
      summary.results.push({
        trust_id: trust.id,
        trust_name: trust.name,
        status: 'skipped',
        reason: eligible.reason,
      })
      continue
    }

    const report = buildTrustReport({
      trust,
      reportType,
      fleetVans: fleet.vans,
    })
    if (!report) {
      summary.skipped += 1
      summary.results.push({
        trust_id: trust.id,
        trust_name: trust.name,
        status: 'skipped',
        reason: 'could not build report',
      })
      continue
    }

    const to = report.recipients.map((r) => r.email)

    if (dryRun) {
      summary.results.push({
        trust_id: trust.id,
        trust_name: trust.name,
        status: 'dry_run',
        recipients: to.length,
        reason: reportSubject(report),
      })
      continue
    }

    try {
      const fleetByInstance = new Map(
        fleet.vans.map((van) => [van.instance, van] as const),
      )
      const performance = await loadReportPerformance({
        reportType,
        fields,
        vans: performanceVans(trust.vans, fleetByInstance, reportType),
      })
      const pdf = await renderPerformancePdf({
        report,
        vans: performance,
        fields,
      })
      const pdfFilename = pdf
        ? performancePdfFilename(report.trustSlug, reportType, performance)
        : null
      let storageNote: string | undefined
      let pdfUrl: string | null = null
      if (pdf && pdfFilename) {
        const period = reportPeriod(reportType, performance)
        try {
          const stored = await storeGeneratedReport({
            trustId: trust.id,
            reportType,
            filename: pdfFilename,
            pdf,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            periodLabel: period.periodLabel,
          })
          try {
            pdfUrl = await signedReportPdfUrl(stored.storagePath)
          } catch {
            pdfUrl = null
          }
        } catch (storageError) {
          storageNote =
            storageError instanceof Error ? storageError.message : 'could not store PDF'
        }
      }
      const rendered = renderTrustEmail({
        report,
        vans: performance,
        fields,
        attached: pdf != null,
      })
      await sendEmail({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments:
          pdf && pdfFilename
            ? [
                {
                  filename: pdfFilename,
                  content: Buffer.from(pdf).toString('base64'),
                },
              ]
            : undefined,
      })

      await db.from('report_runs').insert({
        trust_id: trust.id,
        report_type: reportType,
        status: 'success',
        error: null,
        run_at: new Date().toISOString(),
      })

      summary.sent += 1
      slackItems.push({
        trustName: trust.name,
        emails: to,
        pdfFilename,
        pdfUrl,
      })
      summary.results.push({
        trust_id: trust.id,
        trust_name: trust.name,
        status: 'sent',
        recipients: to.length,
        reason: storageNote ? `email sent; copy not stored: ${storageNote}` : undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send failed'
      await db.from('report_runs').insert({
        trust_id: trust.id,
        report_type: reportType,
        status: 'failure',
        error: message,
        run_at: new Date().toISOString(),
      })
      summary.failed += 1
      summary.results.push({
        trust_id: trust.id,
        trust_name: trust.name,
        status: 'failed',
        reason: message,
      })
    }
  }

  if (!dryRun) {
    await notifyReportsSent({ reportType, items: slackItems })
  }

  return summary
}
