import { grafana } from '../env.js'
import { FLEET_QUERIES, type FleetMetricKey, type PromSample } from './queries.js'

const QUERY_TIMEOUT_MS = 5_000

async function queryInstant(promql: string): Promise<PromSample[]> {
  const base = grafana.baseUrl().replace(/\/$/, '')
  const uid = grafana.prometheusUid()
  const token = grafana.token()
  if (!token) throw new Error('GRAFANA_TOKEN not configured')

  const url = new URL(
    `${base}/api/datasources/proxy/uid/${uid}/api/v1/query`,
  )
  url.searchParams.set('query', promql)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Grafana ${response.status}`)
    }
    const body = (await response.json()) as {
      data?: { result?: PromSample[] }
    }
    return body.data?.result ?? []
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAllFleetSamples(): Promise<
  Partial<Record<FleetMetricKey, PromSample[]>>
> {
  const entries = Object.entries(FLEET_QUERIES) as Array<[FleetMetricKey, string]>
  const results = await Promise.allSettled(
    entries.map(async ([key, promql]) => [key, await queryInstant(promql)] as const),
  )

  const samples: Partial<Record<FleetMetricKey, PromSample[]>> = {}
  let failures = 0
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [key, value] = result.value
      samples[key] = value
    } else {
      failures += 1
    }
  }

  if (failures === entries.length) {
    throw new Error('All Grafana queries failed')
  }

  return samples
}
