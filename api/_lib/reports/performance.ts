import { queryRange, type PromRangeSample } from '../fleet/grafana.js'
import {
  formatUtcTime,
  londonDaysEndingYesterday,
  londonToday,
  type LondonDay,
} from './londonTime.js'
import type { ReportType } from './buildTrustReport.js'
import type { ReportPdfSettings } from './pdfSettings.js'

export type DayPerformance = {
  date: string
  weekday: string
  label: string
  studies: number | null
  speedMbps: number | null
  modalityStart: string | null
  modalityEnd: string | null
}

export type VanPerformance = {
  instance: string
  displayName: string
  days: DayPerformance[]
}

export type PerformanceVanInput = {
  instance: string
  displayName: string
  modalityTarget: string | null
  studiesToday: number | null
  syncSpeedMbps: number | null
}

/** PromQL double-quoted regex. A literal dot must be `\\.` or Grafana returns 400. */
export function promInstanceRegex(values: string[]) {
  return values
    .map((value) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\/g, '\\\\'),
    )
    .join('|')
}

function samplesForInstance(samples: PromRangeSample[], instance: string) {
  return samples.filter((sample) => sample.metric.instance === instance)
}

function valuesInDay(sample: PromRangeSample, day: LondonDay) {
  return sample.values.filter(([ts]) => ts >= day.startSec && ts < day.endSec)
}

/** Labels that identify one summary series, ignoring the metric name. */
function seriesIdentity(metric: Record<string, string>) {
  return Object.keys(metric)
    .filter((key) => key !== '__name__')
    .sort()
    .map((key) => `${key}=${metric[key]}`)
    .join('\n')
}

/**
 * Mean bytes/s from a Prometheus summary (`_sum` / `_count`).
 * A counter that starts at 0 or 1 inside the day includes that first observation.
 * A counter already running before the day contributes only the increase during the day.
 * Several peers are combined as one weighted mean.
 */
function meanSpeedBytes(input: {
  sums: PromRangeSample[]
  counts: PromRangeSample[]
  instance: string
  day: LondonDay
}) {
  const countsByIdentity = new Map(
    samplesForInstance(input.counts, input.instance).map((sample) => [
      seriesIdentity(sample.metric),
      sample,
    ]),
  )
  let sumIncrease = 0
  let countIncrease = 0

  for (const sumSeries of samplesForInstance(input.sums, input.instance)) {
    const countSeries = countsByIdentity.get(seriesIdentity(sumSeries.metric))
    if (!countSeries) continue
    const countAt = new Map(
      valuesInDay(countSeries, input.day).map(([ts, raw]) => [ts, Number(raw)]),
    )
    const paired = valuesInDay(sumSeries, input.day).flatMap(([ts, raw]) => {
      const count = countAt.get(ts)
      const sum = Number(raw)
      if (count == null || !Number.isFinite(count) || !Number.isFinite(sum)) return []
      return [{ sum, count }]
    })
    if (!paired.length) continue

    const first = paired[0]
    if (first.count > 0 && first.count <= 1) {
      sumIncrease += first.sum
      countIncrease += first.count
    }
    for (let index = 1; index < paired.length; index += 1) {
      const previous = paired[index - 1]
      const next = paired[index]
      if (next.count >= previous.count && next.sum >= previous.sum) {
        sumIncrease += next.sum - previous.sum
        countIncrease += next.count - previous.count
      } else if (next.count < previous.count) {
        sumIncrease += Math.max(next.sum, 0)
        countIncrease += Math.max(next.count, 0)
      }
    }
  }

  if (countIncrease <= 0) return null
  return sumIncrease / countIncrease
}

export function bucketVanDays(input: {
  van: PerformanceVanInput
  days: LondonDay[]
  studies: PromRangeSample[]
  speedSums: PromRangeSample[]
  speedCounts: PromRangeSample[]
  modality: PromRangeSample[]
  /** When set, fill today's missing studies/speed from the live fleet snapshot. */
  todayDate?: string
}): DayPerformance[] {
  const studySeries = samplesForInstance(input.studies, input.van.instance)
  const modalityKey = input.van.modalityTarget || input.van.instance
  const modalitySeries = samplesForInstance(input.modality, modalityKey)

  return input.days.map((day) => {
    let studies: number | null = null
    for (const series of studySeries) {
      for (const [, raw] of valuesInDay(series, day)) {
        const value = Number(raw)
        if (!Number.isFinite(value)) continue
        studies = studies == null ? value : Math.max(studies, value)
      }
    }

    const speedBytes = meanSpeedBytes({
      sums: input.speedSums,
      counts: input.speedCounts,
      instance: input.van.instance,
      day,
    })
    let speedMbps = speedBytes == null ? null : speedBytes / 1_000_000

    let modalityStart: string | null = null
    let modalityEnd: string | null = null
    let first = Number.POSITIVE_INFINITY
    let last = Number.NEGATIVE_INFINITY
    for (const series of modalitySeries) {
      for (const [ts, raw] of valuesInDay(series, day)) {
        const value = Number(raw)
        if (!Number.isFinite(value) || value < 1) continue
        if (ts < first) first = ts
        if (ts > last) last = ts
      }
    }
    if (Number.isFinite(first) && Number.isFinite(last)) {
      modalityStart = formatUtcTime(first)
      modalityEnd = formatUtcTime(last)
    }

    const isToday = input.todayDate != null && day.date === input.todayDate
    if (isToday && studies == null && input.van.studiesToday != null) {
      studies = input.van.studiesToday
    }
    if (isToday && speedMbps == null && input.van.syncSpeedMbps != null) {
      speedMbps = input.van.syncSpeedMbps
    }

    return {
      date: day.date,
      weekday: day.weekday,
      label: day.label,
      studies: studies == null ? null : Math.round(studies),
      speedMbps,
      modalityStart,
      modalityEnd,
    }
  })
}

async function safeRange(
  enabled: boolean,
  promql: string,
  startSec: number,
  endSec: number,
  stepSec: number,
) {
  if (!enabled || startSec >= endSec) return [] as PromRangeSample[]
  try {
    return await queryRange(promql, startSec, endSec, stepSec)
  } catch {
    return [] as PromRangeSample[]
  }
}

/**
 * Daily uses the previous London day (the completed day when the morning
 * cron runs). Weekly uses the previous 7 London days (Mon–Sun when the
 * Monday morning cron runs).
 */
export async function loadReportPerformance(input: {
  reportType: ReportType
  vans: PerformanceVanInput[]
  fields: ReportPdfSettings
  now?: Date
}): Promise<VanPerformance[]> {
  const now = input.now ?? new Date()
  const today = londonToday(now)
  const days =
    input.reportType === 'daily'
      ? londonDaysEndingYesterday(1, now)
      : londonDaysEndingYesterday(7, now)

  if (!input.vans.length || !days.length) return []

  const startSec = days[0].startSec
  const endSec = days[days.length - 1].endSec

  const instances = [...new Set(input.vans.map((van) => van.instance))]
  const modalityInstances = [
    ...new Set(
      input.vans.map((van) => van.modalityTarget || van.instance),
    ),
  ]
  const instanceRe = promInstanceRegex(instances)
  const modalityRe = promInstanceRegex(modalityInstances)
  const wantStudies = input.fields.studies || input.fields.week_total
  const wantSpeed = input.fields.transfer_speed
  const wantModality = input.fields.modality_window

  const [studies, speedSums, speedCounts, modality] = await Promise.all([
    safeRange(
      wantStudies && Boolean(instanceRe),
      `orthanc_number_of_studies_today{instance=~"${instanceRe}"}`,
      startSec,
      endSec,
      300,
    ),
    safeRange(
      wantSpeed && Boolean(instanceRe),
      `deos_sync_transfer_speed_sum{instance=~"${instanceRe}"}`,
      startSec,
      endSec,
      300,
    ),
    safeRange(
      wantSpeed && Boolean(instanceRe),
      `deos_sync_transfer_speed_count{instance=~"${instanceRe}"}`,
      startSec,
      endSec,
      300,
    ),
    safeRange(
      wantModality && Boolean(modalityRe),
      `probe_success{job="modality",instance=~"${modalityRe}"}`,
      startSec,
      endSec,
      60,
    ),
  ])

  return input.vans.map((van) => ({
    instance: van.instance,
    displayName: van.displayName,
    days: bucketVanDays({
      van,
      days,
      studies,
      speedSums,
      speedCounts,
      modality,
      todayDate: today.date,
    }),
  }))
}

export function weekStudyTotal(days: DayPerformance[]) {
  const values = days
    .map((day) => day.studies)
    .filter((value): value is number => value != null)
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0)
}
