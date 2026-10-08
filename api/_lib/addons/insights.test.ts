import { describe, expect, it } from 'vitest'
import { buildInsights, headline, periodBetween, periodFor, sumFigures } from './insights'
import { applySample, type DailySummaryRow } from './snapshot'
import type { FleetVan } from '../fleet/types'

function row(partial: Partial<DailySummaryRow> & Pick<DailySummaryRow, 'instance' | 'day'>): DailySummaryRow {
  return {
    trust_slug: 'acme',
    display_name: partial.instance,
    patients: 10,
    studies: 10,
    worklist: 12,
    sync_speed: 1,
    sync_failed: 0,
    sync_complete: 10,
    status: 'green',
    observed_seconds: 3600,
    offline_seconds: 0,
    degraded_seconds: 0,
    moved: false,
    latitude: 51.5,
    longitude: -0.1,
    accuracy_m: 1,
    updated_at: `${partial.day}T16:00:00.000Z`,
    ...partial,
  }
}

const van = {
  instance: 'acme.van1',
  trust: 'acme',
  display_name: 'Van 1',
  status: 'red',
  patients_today: 4,
  studies_today: 4,
  worklist_today: 8,
  sync_speed: 1.2,
  sync_failed: 1,
  sync_complete: 3,
  latitude: 51.5,
  longitude: -0.1,
  gps_source: 'live',
  gps_accuracy: 2,
  gps_recorded_at: '2026-10-06T12:00:00.000Z',
} as FleetVan

describe('daily snapshot', () => {
  it('counts offline time between readings and ignores a long gap', () => {
    const first = applySample(null, van, new Date('2026-10-06T09:00:00.000Z'), '2026-10-06', null)
    expect(first.observed_seconds).toBe(0)
    const second = applySample(
      first,
      van,
      new Date('2026-10-06T09:01:00.000Z'),
      '2026-10-06',
      null,
    )
    expect(second.offline_seconds).toBe(60)
    const nextDay = applySample(
      second,
      { ...van, status: 'green', patients_today: 1 },
      new Date('2026-10-07T09:00:00.000Z'),
      '2026-10-07',
      null,
    )
    expect(nextDay.day).toBe('2026-10-07')
    expect(nextDay.observed_seconds).toBe(0)
    expect(nextDay.patients).toBe(1)
  })
})

describe('insights', () => {
  it('compares a day with the same weekday last week', () => {
    expect(periodFor('day', '2026-10-06')).toMatchObject({
      from: '2026-10-06',
      compareFrom: '2026-09-29',
    })
    const built = buildInsights({
      range: 'day',
      anchor: '2026-10-06',
      rows: [
        row({ instance: 'acme.van1', day: '2026-10-06', patients: 12, worklist: 12 }),
        row({ instance: 'acme.van1', day: '2026-09-29', patients: 10, worklist: 12 }),
      ],
    })
    expect(built.current.patients).toBe(12)
    expect(built.previous?.patients).toBe(10)
    expect(built.headline).toContain('Screening up 20%')
    expect(headline(sumFigures([row({ instance: 'a', day: '2026-10-06', patients: 0, observed_seconds: 0 })]), null)).toBeNull()
  })

  it('keeps the day’s list when a later reading is smaller', () => {
    const morning = applySample(
      null,
      { ...van, patients_today: 3, worklist_today: 42 },
      new Date('2026-10-06T08:00:00.000Z'),
      '2026-10-06',
      null,
    )
    expect(morning.worklist).toBe(45)
    const afternoon = applySample(
      morning,
      { ...van, patients_today: 35, worklist_today: 35 },
      new Date('2026-10-06T15:00:00.000Z'),
      '2026-10-06',
      null,
    )
    expect(afternoon.worklist).toBe(70)
    expect(afternoon.patients).toBe(35)
  })

  it('does not divide a week of patients by a small waiting list', () => {
    const figures = sumFigures([
      row({ instance: 'tic.van', day: '2026-09-30', patients: 49, worklist: 2 }),
      row({ instance: 'tic.van', day: '2026-10-01', patients: 40, worklist: 6 }),
      row({ instance: 'tic.van', day: '2026-10-02', patients: 44, worklist: 6 }),
      row({ instance: 'tic.van', day: '2026-10-03', patients: 47, worklist: 4 }),
      row({ instance: 'tic.van', day: '2026-10-04', patients: 47, worklist: 2 }),
    ])
    expect(figures.patients).toBe(227)
    expect(figures.worklist).toBe(227)
    expect(figures.completion).toBe(1)
  })

  it('uses the loaded list when it is larger than the people screened', () => {
    const figures = sumFigures([
      row({ instance: 'acme.van1', day: '2026-10-06', patients: 35, worklist: 42 }),
    ])
    expect(figures.worklist).toBe(42)
    expect(figures.completion).toBeCloseTo(35 / 42)
  })

  it('sums an explicit date span', () => {
    const period = periodBetween('2026-10-01', '2026-10-07')
    expect(period).toMatchObject({ from: '2026-10-01', to: '2026-10-07', compareTo: '2026-09-30' })
    const built = buildInsights({
      range: 'day',
      anchor: '2026-10-07',
      period,
      rows: [
        row({ instance: 'acme.van1', day: '2026-10-01', patients: 1 }),
        row({ instance: 'acme.van1', day: '2026-10-07', patients: 2 }),
        row({ instance: 'acme.van1', day: '2026-09-30', patients: 9 }),
      ],
    })
    expect(built.current.patients).toBe(3)
    expect(built.previous?.patients).toBe(9)
  })

  it('rolls a trust up across its vans', () => {
    const built = buildInsights({
      range: 'week',
      anchor: '2026-10-06',
      trust: 'acme',
      rows: [
        row({ instance: 'acme.van1', day: '2026-10-05', patients: 5, trust_slug: 'acme' }),
        row({ instance: 'acme.van2', day: '2026-10-05', patients: 7, trust_slug: 'acme' }),
        row({ instance: 'other.van', day: '2026-10-05', patients: 99, trust_slug: 'other' }),
      ],
    })
    expect(built.current.patients).toBe(12)
    expect(built.vans).toHaveLength(2)
  })
})
