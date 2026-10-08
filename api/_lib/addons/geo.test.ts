import { describe, expect, it } from 'vitest'
import {
  accuracyRing,
  condenseTrack,
  gpsHealth,
  haversineMetres,
  isPlottableGps,
  shouldStorePoint,
} from './geo'

describe('gps', () => {
  it('rejects a missing fix at 0,0', () => {
    expect(isPlottableGps(0, 0)).toBe(false)
    expect(gpsHealth({ latitude: 0, longitude: 0, accuracy_m: null })).toBe('no_fix')
  })

  it('flags poor accuracy and leaves a tight fix healthy', () => {
    expect(gpsHealth({ latitude: 51.5, longitude: -0.1, accuracy_m: 500 })).toBe('poor')
    expect(gpsHealth({ latitude: 51.5, longitude: -0.1, accuracy_m: 0.8 })).toBe('ok')
  })

  it('stores a real move and drops jitter inside the accuracy radius', () => {
    const previous = {
      latitude: 51.5,
      longitude: -0.12,
      accuracy_m: 500,
      recorded_at: '2026-10-06T09:00:00.000Z',
      status: 'green',
    }
    const jitter = {
      ...previous,
      latitude: 51.501,
      recorded_at: '2026-10-06T09:05:00.000Z',
    }
    expect(shouldStorePoint(previous, jitter)).toBeNull()
    const moved = {
      ...previous,
      latitude: 52.2,
      longitude: -1.4,
      accuracy_m: 5,
      recorded_at: '2026-10-06T11:00:00.000Z',
    }
    expect(haversineMetres(previous, moved)).toBeGreaterThan(1000)
    expect(shouldStorePoint(previous, moved)).toBe('move')
  })

  it('condenses a stay and a journey', () => {
    const events = condenseTrack([
      {
        latitude: 51.5,
        longitude: -0.12,
        accuracy_m: 5,
        recorded_at: '2026-10-06T08:00:00.000Z',
        status: 'green',
      },
      {
        latitude: 51.5002,
        longitude: -0.1201,
        accuracy_m: 5,
        recorded_at: '2026-10-06T10:00:00.000Z',
        status: 'red',
      },
      {
        latitude: 52.48,
        longitude: -1.89,
        accuracy_m: 8,
        recorded_at: '2026-10-06T12:00:00.000Z',
        status: 'green',
      },
    ])
    expect(events.map((event) => event.kind)).toEqual(['stay', 'move', 'stay'])
  })

  it('closes the accuracy ring', () => {
    const ring = accuracyRing(51.5, -0.12, 40)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(ring.length).toBeGreaterThan(8)
  })
})
