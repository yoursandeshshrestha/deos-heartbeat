import type { TrustReport } from './buildTrustReport.js'
import { dualClock } from './londonTime.js'
import type { ReportPdfSettings } from './pdfSettings.js'
import { hasVisiblePdfFigure } from './pdfSettings.js'
import {
  weekStudyTotal,
  type DayPerformance,
  type VanPerformance,
} from './performance.js'

function formatDateLondon(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function studiesText(value: number | null) {
  return value == null ? 'not available' : String(value)
}

function speedText(value: number | null) {
  return value == null ? 'not available' : `${value.toFixed(2)} MB/s`
}

function windowText(day: DayPerformance) {
  if (!day.modalityStart || !day.modalityEnd) return 'not available'
  return `start time ${dualClock(day.modalityStart)}, end time ${dualClock(day.modalityEnd)} (GMT+01:00)`
}

function describeDay(day: DayPerformance, fields: ReportPdfSettings) {
  const bits: string[] = []
  if (fields.studies) bits.push(`${studiesText(day.studies)} studies`)
  if (fields.transfer_speed) bits.push(`speed ${speedText(day.speedMbps)}`)
  if (fields.modality_window) bits.push(`modality ${windowText(day)}`)
  return bits.join(', ')
}

export function reportSubject(report: TrustReport, date = formatDateLondon(report.generatedAt)) {
  const typeLabel = report.reportType === 'daily' ? 'daily' : 'weekly'
  return `${report.trustName} ${typeLabel} performance summary — ${date}`
}

export function renderTrustEmail(input: {
  report: TrustReport
  vans: VanPerformance[]
  fields: ReportPdfSettings
  attached: boolean
}): {
  subject: string
  html: string
  text: string
} {
  const { report, vans, fields, attached } = input
  const date =
    report.reportType === 'daily' && vans[0]?.days[0]?.label
      ? vans[0].days[0].label
      : formatDateLondon(report.generatedAt)
  const subject = reportSubject(report, date)
  const typeLabel = report.reportType === 'daily' ? 'Daily' : 'Weekly'
  const visible = hasVisiblePdfFigure(fields, report.reportType)

  const textBlocks = vans.map((van) => {
    const lines = van.days.map((day) => {
      const prefix =
        report.reportType === 'weekly' ? `${day.weekday} ${day.label}: ` : ''
      const body = describeDay(day, fields) || 'No figures selected'
      return `  ${prefix}${body}`
    })
    if (report.reportType === 'weekly' && fields.week_total) {
      lines.push(
        `  Week total: ${studiesText(weekStudyTotal(van.days))} studies`,
      )
    }
    return [`${van.displayName}`, ...lines].join('\n')
  })

  const attachmentLine = attached
    ? 'The performance PDF is attached.'
    : visible
      ? 'The PDF could not be attached to this email.'
      : 'No PDF figures are turned on in report settings.'

  const htmlVans = vans
    .map((van) => {
      const items = van.days
        .map((day) => {
          const label =
            report.reportType === 'weekly' ? `${day.weekday} ${day.label}` : day.label
          return `<li style="margin:0 0 6px;">${escapeHtml(label)} — ${escapeHtml(describeDay(day, fields) || 'No figures selected')}</li>`
        })
        .join('')
      const total =
        report.reportType === 'weekly' && fields.week_total
          ? `<p style="margin:8px 0 0;font-size:14px;">Week total: ${escapeHtml(studiesText(weekStudyTotal(van.days)))} studies</p>`
          : ''
      return `<div style="margin:0 0 16px;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(van.displayName)}</div>
        <ul style="margin:8px 0 0;padding-left:18px;color:#374151;font-size:14px;">${items}</ul>
        ${total}
      </div>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:18px 24px;background:#1a295f;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.08em;">DEOS HEARTBEAT</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${escapeHtml(report.trustName)}</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">${typeLabel} performance summary · ${escapeHtml(date)}</p>
        <p style="margin:16px 0;font-size:14px;line-height:1.5;">${escapeHtml(attachmentLine)}</p>
        ${htmlVans}
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Counts only — no patient identifiers.</p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Deos Heartbeat — ${report.trustName}`,
    `${typeLabel} performance summary`,
    date,
    '',
    attachmentLine,
    '',
    ...textBlocks,
    '',
    'Counts only — no patient identifiers.',
  ].join('\n')

  return { subject, html, text }
}
