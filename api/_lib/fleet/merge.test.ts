import { describe, expect, it } from 'vitest'
import { mergeFleetMetrics } from './merge'
import { DEFAULT_FLEET_THRESHOLDS } from './types'
import type { PromSample } from './queries'

function sample(instance: string, trust: string, value: string): PromSample {
  return {
    metric: { instance, trust },
    value: [Date.now() / 1000, value],
  }
}

describe('mergeFleetMetrics', () => {
  it('merges by instance and excludes hubs/routers', () => {
    const payload = mergeFleetMetrics({
      samples: {
        modality_up: [
          sample('bradford.van1', 'bradford', '1'),
          sample('bradford.dserver', 'bradford', '1'),
          sample('bradford.van1.router', 'bradford', '1'),
        ],
        patients_today: [sample('bradford.van1', 'bradford', '4')],
        worklist_today: [sample('bradford.van1', 'bradford', '8')],
        sync_dest_up: [sample('bradford.van1', 'bradford', '0')],
        sync_speed: [sample('bradford.van1', 'bradford', '1500000')],
        scrape_up: [sample('bradford.van1', 'bradford', '1')],
      },
      vans: [
        {
          id: 'db-1',
          instance: 'bradford.van1',
          display_name: 'Bradford 1',
          trust_id: 'trust-1',
          status: 'active',
          speed_floor: null,
          modality_target: null,
          trusts: { id: 'trust-1', name: 'Bradford', slug: 'bradford' },
        },
      ],
      thresholds: DEFAULT_FLEET_THRESHOLDS,
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: 'fixture',
    })

    expect(payload.vans.map((van) => van.instance)).toEqual(['bradford.van1'])
    expect(payload.vans[0].display_name).toBe('Bradford 1')
    expect(payload.vans[0].patients_today).toBe(4)
    expect(payload.vans[0].sync_speed).toBe(1.5)
    expect(payload.trusts[0].trust).toBe('bradford')
  })

  it('remaps modality_target instance labels onto van instance', () => {
    const payload = mergeFleetMetrics({
      samples: {
        modality_up: [
          {
            metric: { instance: '10.0.0.5:104', job: 'modality' },
            value: [Date.now() / 1000, '0'],
          },
        ],
        scrape_up: [sample('demo.van1', 'demo', '1')],
        sync_dest_up: [sample('demo.van1', 'demo', '0')],
        patients_today: [sample('demo.van1', 'demo', '1')],
        worklist_today: [sample('demo.van1', 'demo', '2')],
      },
      vans: [
        {
          id: 'db-2',
          instance: 'demo.van1',
          display_name: 'Demo 1',
          trust_id: 'trust-2',
          status: 'active',
          speed_floor: null,
          modality_target: '10.0.0.5:104',
          trusts: { id: 'trust-2', name: 'Demo', slug: 'demo' },
        },
      ],
      thresholds: DEFAULT_FLEET_THRESHOLDS,
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: 'fixture',
    })

    expect(payload.vans).toHaveLength(1)
    expect(payload.vans[0].modality_up).toBe(0)
    expect(payload.vans[0].status).toBe('red')
  })
})
