import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReader } from './_lib/auth.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { readGeneratedReportPdf } from './_lib/reports/storeGeneratedReport.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const reader = await requireReader(req, res)
  if (!reader) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) {
    json(res, 400, { error: 'id is required' })
    return
  }

  try {
    const file = await readGeneratedReportPdf(id)
    if (!file) {
      json(res, 404, { error: 'Report not found' })
      return
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).send(Buffer.from(file.bytes))
  } catch (error) {
    json(res, 500, {
      error: error instanceof Error ? error.message : 'Could not open report',
    })
  }
}
