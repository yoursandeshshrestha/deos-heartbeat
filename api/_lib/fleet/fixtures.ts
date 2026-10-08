import type { PromSample } from './queries.js'
import type { FleetMetricKey } from './queries.js'

/** Deterministic demo samples when GRAFANA_TOKEN is missing. */
export function fixtureSamples(): Partial<Record<FleetMetricKey, PromSample[]>> {
  const now = Date.now() / 1000
  const van = (instance: string, trust: string, values: Partial<Record<FleetMetricKey, number>>) => {
    const samples: Partial<Record<FleetMetricKey, PromSample[]>> = {}
    for (const [key, value] of Object.entries(values) as Array<[FleetMetricKey, number]>) {
      samples[key] = [
        {
          metric: { instance, trust, job: key === 'modality_up' ? 'modality' : 'deos' },
          value: [now, String(value)],
        },
      ]
    }
    return samples
  }

  const merge = (
    ...parts: Array<Partial<Record<FleetMetricKey, PromSample[]>>>
  ): Partial<Record<FleetMetricKey, PromSample[]>> => {
    const out: Partial<Record<FleetMetricKey, PromSample[]>> = {}
    for (const part of parts) {
      for (const [key, list] of Object.entries(part) as Array<[FleetMetricKey, PromSample[]]>) {
        out[key] = [...(out[key] ?? []), ...list]
      }
    }
    return out
  }

  return merge(
    van('acme.van1-example', 'acme', {
      modality_up: 1,
      sync_dest_up: 0,
      patients_today: 6,
      studies_today: 6,
      worklist_today: 10,
      sync_speed: 1_100_000,
      sync_failed: 0,
      sync_active: 1,
      sync_complete: 5,
      sync_retry: 0,
      db_up: 0,
      orthanc_up: 0,
      scrape_up: 1,
      latitude: 51.5074,
      longitude: -0.1278,
      gps_accuracy: 0.8,
    }),
    van('bradford.van3-ingleborough', 'bradford', {
      modality_up: 0,
      sync_dest_up: 0,
      patients_today: 3,
      studies_today: 3,
      worklist_today: 8,
      sync_speed: 400_000,
      sync_failed: 1,
      sync_active: 0,
      sync_complete: 2,
      sync_retry: 0,
      db_up: 0,
      orthanc_up: 0,
      scrape_up: 1,
      latitude: 53.796,
      longitude: -1.7594,
      gps_accuracy: 12,
    }),
    van('derby.van4-quiet', 'derby', {
      modality_up: 1,
      sync_dest_up: 0,
      patients_today: 0,
      studies_today: 0,
      worklist_today: 0,
      sync_speed: 0,
      sync_failed: 0,
      sync_active: 0,
      sync_complete: 0,
      sync_retry: 0,
      db_up: 0,
      orthanc_up: 0,
      scrape_up: 1,
      latitude: 52.9225,
      longitude: -1.4746,
      gps_accuracy: 480,
    }),
    van('reading.perky', 'reading', {
      modality_up: 1,
      sync_dest_up: 0,
      patients_today: 4,
      studies_today: 4,
      worklist_today: 9,
      sync_speed: 140_000,
      sync_failed: 0,
      sync_active: 2,
      sync_complete: 3,
      sync_retry: 1,
      db_up: 0,
      orthanc_up: 0,
      scrape_up: 1,
      latitude: 51.4543,
      longitude: -0.9781,
      gps_accuracy: 4,
    }),
  )
}
