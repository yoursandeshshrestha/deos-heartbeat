/**
 * Copy up to 120 days of Grafana daily counters into van_daily_summaries.
 * Usage: bun --env-file=.env scripts/import-grafana-history.ts --days 120
 */
import { createClient } from '@supabase/supabase-js'
import { queryRange } from '../api/_lib/fleet/grafana.ts'
import { isExcludedInstance } from '../api/_lib/fleet/queries.ts'
import { londonDay } from '../api/_lib/addons/snapshot.ts'

const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const daysFlag = process.argv.indexOf('--days')
const days = Number(
  daysArg?.split('=')[1] ?? (daysFlag >= 0 ? process.argv[daysFlag + 1] : 120),
)

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.GRAFANA_TOKEN) {
  console.error('Need GRAFANA_TOKEN')
  process.exit(1)
}
if (!Number.isFinite(days) || days < 1 || days > 120) {
  console.error('--days must be between 1 and 120')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const METRICS = [
  ['patients', 'max_over_time(orthanc_number_of_patients_today[1d])'],
  ['studies', 'max_over_time(orthanc_number_of_studies_today[1d])'],
  ['worklist', 'max_over_time(deos_worklist_today_count[1d])'],
  ['sync_failed', 'max_over_time(deos_sync_queue_failed_count[1d])'],
] as const

function dayKey(epochSec: number) {
  return londonDay(new Date(epochSec * 1000))
}

type Row = {
  instance: string
  day: string
  display_name: string
  patients: number | null
  studies: number | null
  worklist: number | null
  sync_failed: number | null
  trust_slug: string | null
}

const rows = new Map<string, Row>()

function ensure(instance: string, day: string) {
  const key = `${instance}|${day}`
  let row = rows.get(key)
  if (!row) {
    row = {
      instance,
      day,
      display_name: instance.split('.').slice(1).join('.') || instance,
      patients: null,
      studies: null,
      worklist: null,
      sync_failed: null,
      trust_slug: instance.split('.')[0] || null,
    }
    rows.set(key, row)
  }
  return row
}

const end = Math.floor(Date.now() / 1000)
const start = end - days * 24 * 60 * 60

for (const [field, promql] of METRICS) {
  console.log('query', field)
  const series = await queryRange(promql, start, end, 60 * 60)
  for (const sample of series) {
    const instance = sample.metric.instance
    if (!instance || isExcludedInstance(instance)) continue
    for (const [ts, raw] of sample.values) {
      const value = Number(raw)
      if (!Number.isFinite(value)) continue
      const row = ensure(instance, dayKey(ts))
      const current = row[field]
      row[field] = current == null ? value : Math.max(current, value)
    }
  }
}

const payload = [...rows.values()]
console.log(`upsert ${payload.length} van-days`)
for (let index = 0; index < payload.length; index += 200) {
  const chunk = payload.slice(index, index + 200)
  const { error } = await db.from('van_daily_summaries').upsert(chunk, { onConflict: 'instance,day' })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}
console.log('done')
