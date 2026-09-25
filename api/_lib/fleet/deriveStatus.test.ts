import { describe, expect, it } from 'vitest'
import { deriveStatus } from './deriveStatus'
import { DEFAULT_FLEET_THRESHOLDS, type VanMetrics } from './types'

function base(overrides: Partial<VanMetrics> = {}, now = Date.now()): VanMetrics {
  return {
    instance: 'demo.van1',
    trust: 'demo',
    modality_up: 1,
    sync_dest_up: 0,
    patients_today: 5,
    studies_today: 5,
    worklist_today: 10,
    sync_speed: 1.2,
    sync_failed: 0,
    sync_active: 1,
    sync_complete: 4,
    sync_retry: 0,
    db_up: 0,
    orthanc_up: 0,
    version: '1.0',
    scrape_up: 1,
    scraped_at: now,
    speed_floor: null,
    ...overrides,
  }
}

describe('deriveStatus', () => {
  it('returns red when modality is down', () => {
    expect(deriveStatus({ metrics: base({ modality_up: 0 }), thresholds: DEFAULT_FLEET_THRESHOLDS }).status).toBe(
      'red',
    )
  })

  it('returns red when sync destination status is non-zero', () => {
    expect(deriveStatus({ metrics: base({ sync_dest_up: 1 }), thresholds: DEFAULT_FLEET_THRESHOLDS }).status).toBe(
      'red',
    )
  })

  it('returns red when scrape is stale', () => {
    const scraped_at = Date.now() - 11 * 60_000
    expect(
      deriveStatus({
        metrics: base({ scraped_at }),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
      }).status,
    ).toBe('red')
  })

  it('returns grey when nothing scheduled', () => {
    expect(
      deriveStatus({
        metrics: base({ worklist_today: 0, patients_today: 0 }),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
      }).status,
    ).toBe('grey')
  })

  it('returns amber when sync_failed exceeds threshold', () => {
    expect(
      deriveStatus({
        metrics: base({ sync_failed: 3 }),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
      }).status,
    ).toBe('amber')
  })

  it('returns amber when speed below per-van floor', () => {
    expect(
      deriveStatus({
        metrics: base({ sync_speed: 0.1, speed_floor: 0.5 }),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
      }).status,
    ).toBe('amber')
  })

  it('returns amber for low midday progress', () => {
    const noonish = new Date('2026-09-25T13:00:00')
    expect(
      deriveStatus({
        metrics: base({ patients_today: 2, worklist_today: 10 }, noonish.getTime()),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
        now: noonish,
      }).status,
    ).toBe('amber')
  })

  it('returns green when healthy', () => {
    const noonish = new Date('2026-09-25T13:00:00')
    expect(
      deriveStatus({
        metrics: base({}, noonish.getTime()),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
        now: noonish,
      }).status,
    ).toBe('green')
  })

  it('prefers red over grey', () => {
    expect(
      deriveStatus({
        metrics: base({ modality_up: 0, worklist_today: 0, patients_today: 0 }),
        thresholds: DEFAULT_FLEET_THRESHOLDS,
      }).status,
    ).toBe('red')
  })
})
