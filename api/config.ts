import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'

export const config = {
  regions: ['lhr1'],
}

/**
 * Authenticated app config for the SPA (thresholds, etc.).
 * Session auth + real payload in Phase 2+. Stub for route wiring.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  return json(res, 501, {
    error: 'Not implemented',
    phase: 2,
  })
}
