import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReader } from './_lib/auth.js'
import {
  buildInsights,
  insightsToCsv,
  isInsightRange,
  periodBetween,
  periodFor,
  type InsightRange,
} from './_lib/addons/insights.js'
import { londonDay } from './_lib/addons/snapshot.js'
import { loadSummaries } from './_lib/addons/store.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'

export const config = { regions: ['lhr1'], maxDuration: 20 }

function queryValue(req: VercelRequest, name: string) {
  const value = req.query[name]
  return typeof value === 'string' ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const reader = await requireReader(req, res)
  if (!reader) return

  const fromQuery = queryValue(req, 'from')
  const toQuery = queryValue(req, 'to')
  const customRange = fromQuery != null || toQuery != null
  if (customRange && (!isIsoDate(fromQuery) || !isIsoDate(toQuery) || fromQuery > toQuery)) {
    return json(res, 400, { error: 'from and to must be YYYY-MM-DD, with from on or before to' })
  }

  const requestedRange = queryValue(req, 'range') ?? 'day'
  const range: InsightRange = isInsightRange(requestedRange) ? requestedRange : 'day'
  if (!customRange && !isInsightRange(requestedRange)) {
    return json(res, 400, { error: "range must be day, week, 3m, 6m, 12m, or all" })
  }
  const anchor = queryValue(req, 'date') ?? toQuery ?? londonDay(new Date())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    return json(res, 400, { error: 'date must be YYYY-MM-DD' })
  }
  const trust = queryValue(req, 'trust')
  const instance = queryValue(req, 'instance')
  const period = customRange ? periodBetween(fromQuery!, toQuery!) : periodFor(range, anchor)
  let from = period.compareFrom ?? period.from
  if (instance) {
    const monthFrom = `${anchor.slice(0, 7)}-01`
    if (monthFrom < from) from = monthFrom
  }
  const to = period.to > anchor ? period.to : anchor

  try {
    const rows = await loadSummaries(from, to)
    const view = buildInsights({
      rows,
      range: customRange ? 'day' : range,
      anchor,
      trust,
      instance,
      period: customRange ? period : undefined,
    })
    if (queryValue(req, 'format') === 'csv') {
      const exported = rows.filter((row) => {
        if (instance && row.instance !== instance) return false
        if (trust && row.trust_slug !== trust) return false
        return row.day >= period.from && row.day <= period.to
      })
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="ukdeos-history.csv"')
      return res.status(200).send(insightsToCsv(exported))
    }
    return json(res, 200, view)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load history'
    return json(res, 200, {
      range,
      from: period.from,
      to: period.to,
      compareFrom: period.compareFrom,
      compareTo: period.compareTo,
      headline: null,
      current: emptyFigures(),
      previous: null,
      trusts: [],
      vans: [],
      series: [],
      calendar: [],
      notice: message,
    })
  }
}

function isIsoDate(value: string | null): value is string {
  return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function emptyFigures() {
  return {
    patients: 0,
    worklist: 0,
    studies: 0,
    completion: null,
    syncSpeed: null,
    syncFailed: 0,
    syncComplete: 0,
    uptimePct: null,
    offlineMinutes: 0,
  }
}
