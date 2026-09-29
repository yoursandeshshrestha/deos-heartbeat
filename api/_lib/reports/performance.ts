import { queryRange, type PromRangeSample } from '../fleet/grafana.js'
import {
  formatLondonTime,
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

function promRegex(values: string[]) {
  return values
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
}

function samplesForInstance(samples: PromRangeSample[], instance: string) {
  return samples.filter((sample) => sample.metric.instance === instance)
}

function valuesInDay(sample: PromRangeSample, day: LondonDay) {
  return sample.values.filter(([ts]) => ts >= day.startSec && ts < day.endSec)
}

export function bucketVanDays(input: {
  van: PerformanceVanInput
  days: LondonDay[]
  studies: PromRangeSample[]
  speeds: PromRangeSample[]
  modality: PromRangeSample[]
  /** When set, fill today's missing studies/speed from the live fleet snapshot. */
  todayDate?: string
}): DayPerformance[] {
  const studySeries = samplesForInstance(input.studies, input.van.instance)
  const speedSeries = samplesForInstance(input.speeds, input.van.instance)
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

    const speeds: number[] = []
    for (const series of speedSeries) {
      for (const [, raw] of valuesInDay(series, day)) {
        const bytes = Number(raw)
        if (!Number.isFinite(bytes) || bytes <= 0) continue
        speeds.push(bytes / 1_000_000)
      }
    }
    let speedMbps =
      speeds.length > 0
        ? speeds.reduce((total, value) => total + value, 0) / speeds.length
        : null

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
      modalityStart = formatLondonTime(first)
      modalityEnd = formatLondonTime(last)
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
 * Daily uses today (London). Weekly uses the previous 7 London days
 * (Mon–Sun when the Monday morning cron runs).
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
      ? [today]
      : londonDaysEndingYesterday(7, now)

  if (!input.vans.length || !days.length) return []

  const startSec = days[0].startSec
  const endSec =
    input.reportType === 'daily'
      ? Math.floor(now.getTime() / 1000)
      : days[days.length - 1].endSec

  const instances = [...new Set(input.vans.map((van) => van.instance))]
  const modalityInstances = [
    ...new Set(
      input.vans.map((van) => van.modalityTarget || van.instance),
    ),
  ]
  const instanceRe = promRegex(instances)
  const modalityRe = promRegex(modalityInstances)
  const wantStudies = input.fields.studies || input.fields.week_total
  const wantSpeed = input.fields.transfer_speed
  const wantModality = input.fields.modality_window

  const [studies, speeds, modality] = await Promise.all([
    safeRange(
      wantStudies && Boolean(instanceRe),
      `orthanc_number_of_studies_today{instance=~"${instanceRe}"}`,
      startSec,
      endSec,
      1800,
    ),
    safeRange(
      wantSpeed && Boolean(instanceRe),
      `deos_sync_transfer_speed{instance=~"${instanceRe}"}`,
      startSec,
      endSec,
      1800,
    ),
    safeRange(
      wantModality && Boolean(modalityRe),
      `probe_success{job="modality",instance=~"${modalityRe}"}`,
      startSec,
      endSec,
      300,
    ),
  ])

  return input.vans.map((van) => ({
    instance: van.instance,
    displayName: van.displayName,
    days: bucketVanDays({
      van,
      days,
      studies,
      speeds,
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
