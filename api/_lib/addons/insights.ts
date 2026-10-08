import type { DailySummaryRow } from './snapshot.js'

export type InsightRange = 'day' | 'week' | '3m' | '6m' | '12m' | 'all'

export type Figures = {
  patients: number
  worklist: number
  studies: number
  completion: number | null
  syncSpeed: number | null
  syncFailed: number
  syncComplete: number
  uptimePct: number | null
  offlineMinutes: number
}

export type InsightPeriod = {
  from: string
  to: string
  compareFrom: string | null
  compareTo: string | null
}

const RANGES = new Set<InsightRange>(['day', 'week', '3m', '6m', '12m', 'all'])

export function isInsightRange(value: string | null | undefined): value is InsightRange {
  return value != null && RANGES.has(value as InsightRange)
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function weekdayMon0(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (sunday0 + 6) % 7
}

function shiftMonth(iso: string, delta: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  const nextDay = Math.min(day, last)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-${String(nextDay).padStart(2, '0')}`
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

/** Inclusive span, compared with the previous span of the same length. */
export function periodBetween(from: string, to: string): InsightPeriod {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const length = Math.round((end - start) / 86_400_000) + 1
  const compareTo = addDays(from, -1)
  return {
    from,
    to,
    compareFrom: addDays(compareTo, -(length - 1)),
    compareTo,
  }
}

export function periodFor(range: InsightRange, anchor: string): InsightPeriod {
  if (range === 'day') {
    const previous = addDays(anchor, -7)
    return { from: anchor, to: anchor, compareFrom: previous, compareTo: previous }
  }
  if (range === 'week') {
    const from = addDays(anchor, -weekdayMon0(anchor))
    const to = addDays(from, 6)
    const compareTo = addDays(from, -1)
    return { from, to, compareFrom: addDays(compareTo, -6), compareTo }
  }
  if (range === 'all') {
    return { from: '1970-01-01', to: anchor, compareFrom: null, compareTo: null }
  }
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const to = anchor
  const from = monthStart(shiftMonth(anchor, -(months - 1)))
  const compareTo = addDays(from, -1)
  const compareFrom = monthStart(shiftMonth(compareTo, -(months - 1)))
  return { from, to, compareFrom, compareTo }
}

function inSpan(day: string, from: string, to: string) {
  return day >= from && day <= to
}

export function sumFigures(rows: DailySummaryRow[]): Figures {
  let patients = 0
  let worklist = 0
  let studies = 0
  let syncFailed = 0
  let syncComplete = 0
  let speedSum = 0
  let speedWeight = 0
  let observed = 0
  let offline = 0

  for (const row of rows) {
    const dayPatients = Number(row.patients ?? 0)
    const dayList = Number(row.worklist ?? 0)
    patients += dayPatients
    // The stored list count is the most names waiting at once. When more
    // people were screened than that, the list was topped up through the day,
    // so the day was at least as long as the people screened.
    worklist += Math.max(dayPatients, dayList)
    studies += Number(row.studies ?? 0)
    syncFailed += Number(row.sync_failed ?? 0)
    syncComplete += Number(row.sync_complete ?? 0)
    if (row.sync_speed != null && Number.isFinite(Number(row.sync_speed))) {
      const weight = Math.max(1, Number(row.studies ?? 0))
      speedSum += Number(row.sync_speed) * weight
      speedWeight += weight
    }
    observed += Number(row.observed_seconds ?? 0)
    offline += Number(row.offline_seconds ?? 0)
  }

  return {
    patients,
    worklist,
    studies,
    completion: worklist > 0 ? patients / worklist : null,
    syncSpeed: speedWeight > 0 ? speedSum / speedWeight : null,
    syncFailed,
    syncComplete,
    uptimePct: observed > 0 ? ((observed - offline) / observed) * 100 : null,
    offlineMinutes: Math.round(offline / 60),
  }
}

export function headline(current: Figures, previous: Figures | null) {
  if (current.patients === 0 && current.uptimePct == null) return null
  if (!previous || previous.patients <= 0) {
    if (current.uptimePct != null && current.patients > 0) {
      return `${current.patients.toLocaleString('en-GB')} patients screened. Uptime ${current.uptimePct.toFixed(1)}%`
    }
    if (current.uptimePct != null) return `Uptime ${current.uptimePct.toFixed(1)}% for this period`
    return `${current.patients.toLocaleString('en-GB')} patients screened`
  }
  const pct = ((current.patients - previous.patients) / previous.patients) * 100
  const direction = pct >= 0 ? 'up' : 'down'
  const screening = `Screening ${direction} ${Math.abs(pct).toFixed(0)}% on the previous period`
  if (current.uptimePct == null) return screening
  return `${screening}. Uptime ${current.uptimePct.toFixed(1)}%`
}

export type BuiltInsights = {
  range: InsightRange
  from: string
  to: string
  compareFrom: string | null
  compareTo: string | null
  headline: string | null
  current: Figures
  previous: Figures | null
  trusts: Array<{ slug: string; figures: Figures }>
  vans: Array<{
    instance: string
    displayName: string
    trust: string | null
    status: string | null
    figures: Figures
  }>
  series: Array<{ date: string; patients: number; worklist: number }>
  calendar: Array<{ date: string; status: string | null; moved: boolean }>
}

export function buildInsights(input: {
  rows: DailySummaryRow[]
  range: InsightRange
  anchor: string
  trust?: string | null
  instance?: string | null
  period?: InsightPeriod
}): BuiltInsights {
  const period = input.period ?? periodFor(input.range, input.anchor)
  const scoped = input.rows.filter((row) => {
    if (input.instance && row.instance !== input.instance) return false
    if (input.trust && row.trust_slug !== input.trust) return false
    return true
  })
  const currentRows = scoped.filter((row) => inSpan(row.day, period.from, period.to))
  const previousRows =
    period.compareFrom && period.compareTo
      ? scoped.filter((row) => inSpan(row.day, period.compareFrom!, period.compareTo!))
      : []
  const current = sumFigures(currentRows)
  const previous = period.compareFrom ? sumFigures(previousRows) : null

  const trustMap = new Map<string, DailySummaryRow[]>()
  for (const row of currentRows) {
    const key = row.trust_slug || 'unassigned'
    const list = trustMap.get(key) ?? []
    list.push(row)
    trustMap.set(key, list)
  }
  const trusts = [...trustMap.entries()]
    .map(([slug, rows]) => ({ slug, figures: sumFigures(rows) }))
    .sort((a, b) => b.figures.patients - a.figures.patients)

  const vanMap = new Map<string, DailySummaryRow[]>()
  for (const row of currentRows) {
    const list = vanMap.get(row.instance) ?? []
    list.push(row)
    vanMap.set(row.instance, list)
  }
  const vans = [...vanMap.entries()]
    .map(([instance, rows]) => {
      const latest = [...rows].sort((a, b) => (a.day < b.day ? 1 : -1))[0]
      return {
        instance,
        displayName: latest?.display_name ?? instance,
        trust: latest?.trust_slug ?? null,
        status: latest?.status ?? null,
        figures: sumFigures(rows),
      }
    })
    .sort((a, b) => b.figures.patients - a.figures.patients)

  const byDay = new Map<string, DailySummaryRow[]>()
  for (const row of currentRows) {
    const list = byDay.get(row.day) ?? []
    list.push(row)
    byDay.set(row.day, list)
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, rows]) => {
      const figures = sumFigures(rows)
      return { date, patients: figures.patients, worklist: figures.worklist }
    })

  const calendarSource = input.instance
    ? scoped
    : currentRows.filter((row) => !input.instance)
  const calendarMap = new Map<string, { status: string | null; moved: boolean }>()
  for (const row of calendarSource) {
    const prev = calendarMap.get(row.day)
    const rank = statusRank(row.status)
    const prevRank = statusRank(prev?.status ?? null)
    calendarMap.set(row.day, {
      status: !prev || rank > prevRank ? row.status : prev.status,
      moved: Boolean(prev?.moved) || Boolean(row.moved),
    })
  }
  const calendar = [...calendarMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, status: value.status, moved: value.moved }))

  return {
    range: input.range,
    from: period.from,
    to: period.to,
    compareFrom: period.compareFrom,
    compareTo: period.compareTo,
    headline: headline(current, previous),
    current,
    previous,
    trusts,
    vans,
    series,
    calendar,
  }
}

function statusRank(status: string | null) {
  if (status === 'red') return 4
  if (status === 'amber') return 3
  if (status === 'grey') return 2
  if (status === 'green') return 1
  return 0
}

export function insightsToCsv(rows: DailySummaryRow[]) {
  const header = [
    'day',
    'trust',
    'instance',
    'display_name',
    'patients',
    'worklist',
    'studies',
    'sync_speed_mbps',
    'sync_failed',
    'status',
    'uptime_pct',
    'offline_minutes',
    'moved',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    const observed = Number(row.observed_seconds ?? 0)
    const offline = Number(row.offline_seconds ?? 0)
    const uptime = observed > 0 ? (((observed - offline) / observed) * 100).toFixed(1) : ''
    const cells = [
      row.day,
      row.trust_slug ?? '',
      row.instance,
      row.display_name,
      row.patients ?? '',
      row.worklist ?? '',
      row.studies ?? '',
      row.sync_speed ?? '',
      row.sync_failed ?? '',
      row.status ?? '',
      uptime,
      observed ? Math.round(offline / 60) : '',
      row.moved ? 'yes' : 'no',
    ]
    lines.push(cells.map(csvCell).join(','))
  }
  return lines.join('\n')
}

function csvCell(value: string | number | boolean) {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}
