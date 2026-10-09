import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildFleetPayload } from './_lib/fleet/build.js'
import {
  briefingCacheKey,
  buildFleetBriefing,
  buildFleetBriefingFacts,
  getCachedBriefing,
  setCachedBriefing,
} from './_lib/fleet/briefing.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { rateLimit } from './_lib/rateLimit.js'

export const config = {
  regions: ['lhr1'],
  maxDuration: 30,
}

/**
 * Structured plain-English fleet briefing for the dashboard overview.
 * Optional query: trust=Name (or all).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  if (!rateLimit(req, res, { scope: 'fleet-summary', limit: 40, windowMs: 5 * 60_000 })) {
    return
  }

  const trustRaw = req.query.trust
  const trustFilter =
    typeof trustRaw === 'string' && trustRaw.trim() ? trustRaw.trim() : 'all'
  const nameRaw = req.query.name
  const viewerName =
    typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : null

  try {
    const fleet = await buildFleetPayload()
    const facts = buildFleetBriefingFacts(fleet, trustFilter)
    const key = briefingCacheKey(facts, viewerName)
    const cached = getCachedBriefing(key)
    if (cached) {
      return json(res, 200, {
        ...cached,
        cached: true,
        facts,
      })
    }

    const briefing = buildFleetBriefing(facts, viewerName)
    setCachedBriefing(key, briefing)
    return json(res, 200, {
      ...briefing,
      cached: false,
      facts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json(res, 500, { error: message })
  }
}
