import { describe, expect, it } from 'vitest'
import { mergeFleetMetrics } from './merge'
import { DEFAULT_FLEET_THRESHOLDS } from './types'
import type { PromSample } from './queries'

/** Recorded-shape Grafana instant query results (empty + timeout-like partial). */
const EMPTY_RESULT: PromSample[] = []

describe('/api/fleet recorded responses', () => {
  it('handles fully empty Grafana results', () => {
    const payload = mergeFleetMetrics({
      samples: {
        modality_up: EMPTY_RESULT,
        sync_dest_up: EMPTY_RESULT,
        patients_today: EMPTY_RESULT,
        scrape_up: EMPTY_RESULT,
      },
      vans: [
        {
          id: '1',
          instance: 'acme.van1',
          display_name: 'Acme',
          trust_id: null,
          status: 'unassigned',
          speed_floor: null,
          modality_target: null,
          trusts: null,
        },
      ],
      thresholds: DEFAULT_FLEET_THRESHOLDS,
      fetchedAt: '2026-09-25T00:00:00.000Z',
      stale: false,
      source: 'acme',
    })

    expect(payload.vans).toHaveLength(1)
    expect(payload.vans[0].status).toBe('red')
    expect(payload.vans[0].reason).toMatch(/no scrape data/i)
  })

  it('merges partial success when some queries timed out (missing keys)', () => {
    const now = Date.now() / 1000
    const payload = mergeFleetMetrics({
      samples: {
        // modality missing = timed out
        patients_today: [
          { metric: { instance: 'acme.van1', trust: 'acme' }, value: [now, '3'] },
        ],
        worklist_today: [
          { metric: { instance: 'acme.van1', trust: 'acme' }, value: [now, '5'] },
        ],
        sync_dest_up: [
          { metric: { instance: 'acme.van1', trust: 'acme' }, value: [now, '0'] },
        ],
        scrape_up: [
          { metric: { instance: 'acme.van1', trust: 'acme' }, value: [now, '1'] },
        ],
      },
      vans: [
        {
          id: '1',
          instance: 'acme.van1',
          display_name: 'Acme',
          trust_id: 't1',
          status: 'active',
          speed_floor: null,
          modality_target: null,
          trusts: { id: 't1', name: 'Acme', slug: 'acme' },
        },
      ],
      thresholds: DEFAULT_FLEET_THRESHOLDS,
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: 'grafana',
    })

    expect(payload.vans[0].patients_today).toBe(3)
    expect(payload.vans[0].modality_up).toBeNull()
    expect(payload.vans[0].status).not.toBe('red')
  })
})
