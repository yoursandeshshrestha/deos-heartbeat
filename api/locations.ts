import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReader } from './_lib/auth.js'
import { condenseTrack, siteVisits, type TrackPoint } from './_lib/addons/geo.js'
import { londonDay } from './_lib/addons/snapshot.js'
import { addDays } from './_lib/addons/insights.js'
import { supabase as supabaseEnv } from './_lib/env.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { getServiceClient } from './_lib/supabase.js'

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

  const instance = queryValue(req, 'instance')
  if (!instance) return json(res, 400, { error: 'instance is required' })
  const date = queryValue(req, 'date') ?? londonDay(new Date())
  const fromDay = queryValue(req, 'from') ?? date
  const toDay = queryValue(req, 'to') ?? date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || fromDay > toDay) {
    return json(res, 400, { error: 'from and to must be YYYY-MM-DD, with from on or before to' })
  }
  if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) {
    return json(res, 200, { date: fromDay, points: [], timeline: [], visits: [], notice: 'Database is not configured' })
  }

  try {
    const db = getServiceClient()
    const from = `${addDays(fromDay, -1)}T00:00:00.000Z`
    const to = `${addDays(toDay, 2)}T00:00:00.000Z`
    const points: TrackPoint[] = []
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db
        .from('van_location_points')
        .select('latitude, longitude, accuracy_m, status, recorded_at')
        .eq('instance', instance)
        .gte('recorded_at', from)
        .lt('recorded_at', to)
        .order('recorded_at', { ascending: true })
        .range(start, start + 999)
      if (error) throw new Error(error.message)
      const page = (data ?? []) as Array<{
        latitude: number
        longitude: number
        accuracy_m: number | null
        status: string | null
        recorded_at: string
      }>
      for (const row of page) {
        points.push({
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),
          status: row.status,
          recorded_at: row.recorded_at,
        })
      }
      if (page.length < 1000) break
    }

    const dayPoints = points.filter((point) => {
      const london = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(point.recorded_at))
      return london >= fromDay && london <= toDay
    })
    const timeline = condenseTrack(dayPoints)
    const visits = siteVisits(timeline)
    return json(res, 200, {
      date: fromDay,
      points: dayPoints,
      timeline,
      visits,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load locations'
    return json(res, 200, { date, points: [], timeline: [], visits: [], notice: message })
  }
}
