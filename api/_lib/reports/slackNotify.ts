import { optionalEnv } from '../env.js'
import type { ReportType } from './buildTrustReport.js'

export type SlackReportItem = {
  trustName: string
  emails: string[]
  pdfFilename: string | null
  pdfUrl?: string | null
}

function londonDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** One Slack message for every trust emailed in a single send run. */
export function formatReportSlackMessage(input: {
  reportType: ReportType
  items: SlackReportItem[]
  sentAt?: Date
}) {
  const label = input.reportType === 'daily' ? 'Daily' : 'Weekly'
  const date = londonDateLabel(input.sentAt ?? new Date())
  const trusts = input.items
    .map((item) => {
      const sentTo = item.emails.join(', ')
      const pdf = pdfLine(item)
      return `${item.trustName}\nSent to: ${sentTo}\nPDF: ${pdf}`
    })
    .join('\n\n')

  return `✅ ${label} reports sent — ${date}\n\n${input.items.length} sent\n\n${trusts}`
}

function pdfLine(item: SlackReportItem) {
  if (!item.pdfFilename) return 'none'
  if (!item.pdfUrl) return item.pdfFilename
  return `<${item.pdfUrl}|${item.pdfFilename}>`
}

/** Posts after a successful send. Missing webhook or a Slack error must not fail the emails. */
export async function notifyReportsSent(input: {
  reportType: ReportType
  items: SlackReportItem[]
}) {
  if (!input.items.length) return
  const webhook = optionalEnv('SLACK_REPORT_WEBHOOK_URL')
  if (!webhook) return

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: formatReportSlackMessage(input) }),
    })
    if (!response.ok) {
      console.error(`Slack report notify failed (${response.status})`)
    }
  } catch (error) {
    console.error(
      'Slack report notify failed',
      error instanceof Error ? error.message : error,
    )
  }
}
