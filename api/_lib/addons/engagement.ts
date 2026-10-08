export type DeliveryRow = {
  id: string
  trust_id: string
  trust_name: string
  recipient_id: string | null
  recipient_name: string | null
  email: string
  active: boolean
  report_type: 'daily' | 'weekly'
  batch_id: string
  resend_id: string | null
  sent_at: string
  opened_at: string | null
}

export type EngagementView = {
  sent: number
  opened: number
  openRate: number | null
  previousSent: number
  previousOpened: number
  previousOpenRate: number | null
  trend: Array<{ week: string; sent: number; opened: number; openRate: number | null }>
  trusts: Array<{
    trustId: string
    trustName: string
    recipients: number
    sent: number
    opened: number
    openRate: number | null
    quiet: number
    lastOpened: string | null
  }>
  recipients: Array<{
    recipientId: string | null
    email: string
    name: string | null
    trustId: string
    trustName: string
    active: boolean
    sent: number
    opened: number
    openRate: number | null
    lastOpened: string | null
    quiet: boolean
  }>
  reports: Array<{
    batchId: string
    trustId: string
    trustName: string
    reportType: 'daily' | 'weekly'
    sentAt: string
    sent: number
    opened: number
    openRate: number | null
    opens: Array<{ email: string; openedAt: string | null }>
  }>
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const QUIET_MS = 28 * 24 * 60 * 60 * 1000

function rate(opened: number, sent: number) {
  if (sent <= 0) return null
  return opened / sent
}

function weekStart(time: number) {
  const date = new Date(time)
  const day = date.getUTCDay()
  const mondayOffset = (day + 6) % 7
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - mondayOffset)
  return new Date(start).toISOString().slice(0, 10)
}

export function buildEngagement(rows: DeliveryRow[], now = new Date()): EngagementView {
  const nowMs = now.getTime()
  const thisWeek = nowMs - WEEK_MS
  const lastWeek = nowMs - 2 * WEEK_MS
  let sent = 0
  let opened = 0
  let previousSent = 0
  let previousOpened = 0

  for (const row of rows) {
    const at = new Date(row.sent_at).getTime()
    const wasOpened = row.opened_at != null
    if (at >= thisWeek) {
      sent += 1
      if (wasOpened) opened += 1
    } else if (at >= lastWeek) {
      previousSent += 1
      if (wasOpened) previousOpened += 1
    }
  }

  const trendMap = new Map<string, { sent: number; opened: number }>()
  for (let i = 7; i >= 0; i -= 1) {
    trendMap.set(weekStart(nowMs - i * WEEK_MS), { sent: 0, opened: 0 })
  }
  for (const row of rows) {
    const key = weekStart(new Date(row.sent_at).getTime())
    const bucket = trendMap.get(key)
    if (!bucket) continue
    bucket.sent += 1
    if (row.opened_at) bucket.opened += 1
  }
  const trend = [...trendMap.entries()].map(([week, bucket]) => ({
    week,
    sent: bucket.sent,
    opened: bucket.opened,
    openRate: rate(bucket.opened, bucket.sent),
  }))

  const byTrust = new Map<string, DeliveryRow[]>()
  for (const row of rows) {
    const list = byTrust.get(row.trust_id) ?? []
    list.push(row)
    byTrust.set(row.trust_id, list)
  }

  const trusts = [...byTrust.entries()].map(([trustId, list]) => {
    const people = new Set(list.map((row) => row.email))
    const openedRows = list.filter((row) => row.opened_at)
    const lastOpened = openedRows
      .map((row) => row.opened_at as string)
      .sort()
      .at(-1) ?? null
    const quiet = [...people].filter((email) => {
      const mine = list.filter((row) => row.email === email)
      return isQuiet(mine, nowMs)
    }).length
    return {
      trustId,
      trustName: list[0]?.trust_name ?? trustId,
      recipients: people.size,
      sent: list.length,
      opened: openedRows.length,
      openRate: rate(openedRows.length, list.length),
      quiet,
      lastOpened,
    }
  }).sort((a, b) => (a.openRate ?? 1) - (b.openRate ?? 1))

  const byPerson = new Map<string, DeliveryRow[]>()
  for (const row of rows) {
    const key = `${row.trust_id}:${row.email}`
    const list = byPerson.get(key) ?? []
    list.push(row)
    byPerson.set(key, list)
  }
  const recipients = [...byPerson.values()].map((list) => {
    const openedRows = list.filter((row) => row.opened_at)
    const lastOpened = openedRows.map((row) => row.opened_at as string).sort().at(-1) ?? null
    const sample = list[0]
    return {
      recipientId: sample.recipient_id,
      email: sample.email,
      name: sample.recipient_name,
      trustId: sample.trust_id,
      trustName: sample.trust_name,
      active: sample.active,
      sent: list.length,
      opened: openedRows.length,
      openRate: rate(openedRows.length, list.length),
      lastOpened,
      quiet: isQuiet(list, nowMs),
    }
  }).sort((a, b) => Number(b.quiet) - Number(a.quiet) || a.email.localeCompare(b.email))

  const byBatch = new Map<string, DeliveryRow[]>()
  for (const row of rows) {
    const list = byBatch.get(row.batch_id) ?? []
    list.push(row)
    byBatch.set(row.batch_id, list)
  }
  const reports = [...byBatch.values()]
    .map((list) => {
      const openedRows = list.filter((row) => row.opened_at)
      const sample = list[0]
      return {
        batchId: sample.batch_id,
        trustId: sample.trust_id,
        trustName: sample.trust_name,
        reportType: sample.report_type,
        sentAt: list.map((row) => row.sent_at).sort()[0],
        sent: list.length,
        opened: openedRows.length,
        openRate: rate(openedRows.length, list.length),
        opens: list
          .map((row) => ({ email: row.email, openedAt: row.opened_at }))
          .sort((a, b) => a.email.localeCompare(b.email)),
      }
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))

  return {
    sent,
    opened,
    openRate: rate(opened, sent),
    previousSent,
    previousOpened,
    previousOpenRate: rate(previousOpened, previousSent),
    trend,
    trusts,
    recipients,
    reports,
  }
}

function isQuiet(rows: DeliveryRow[], nowMs: number) {
  if (!rows.length) return false
  const lastOpen = rows
    .map((row) => (row.opened_at ? new Date(row.opened_at).getTime() : 0))
    .reduce((max, value) => Math.max(max, value), 0)
  if (!lastOpen) return true
  return nowMs - lastOpen >= QUIET_MS
}
