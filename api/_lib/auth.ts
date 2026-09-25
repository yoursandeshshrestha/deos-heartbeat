import type { VercelRequest, VercelResponse } from '@vercel/node'
import { reportConfigKey } from './env.js'
import { json, readBearer } from './http.js'

/** Static API key for report workflow endpoints. */
export function requireReportConfigKey(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const expected = reportConfigKey()
  if (!expected) {
    json(res, 503, { error: 'REPORT_CONFIG_KEY not configured' })
    return false
  }

  const provided =
    readBearer(req) ??
    (typeof req.headers['x-api-key'] === 'string'
      ? req.headers['x-api-key']
      : null)

  if (!provided || provided !== expected) {
    json(res, 401, { error: 'Unauthorized' })
    return false
  }

  return true
}
