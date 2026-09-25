import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildFleetPayload } from './_lib/fleet/build.js'
import { json, methodNotAllowed } from './_lib/http.js'

export const config = {
  regions: ['lhr1'],
  maxDuration: 15,
}

/**
 * Live fleet metrics. Uses Grafana when GRAFANA_TOKEN is set; otherwise fixtures.
 * Cached 30s; on Grafana failure returns last good payload with stale: true.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  try {
    const payload = await buildFleetPayload()
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30')
    return json(res, 200, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json(res, 500, { error: message })
  }
}
