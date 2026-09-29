import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReportConfigKey } from './_lib/auth.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { rateLimit } from './_lib/rateLimit.js'
import { getServiceClient } from './_lib/supabase.js'

export const config = {
  regions: ['lhr1'],
}

type ReportRunBody = {
  trust_id?: string
  report_type?: string
  status?: string
  error?: string | null
  run_at?: string
}

function isReportType(value: unknown): value is 'daily' | 'weekly' {
  return value === 'daily' || value === 'weekly'
}

function isRunStatus(value: unknown): value is 'success' | 'failure' {
  return value === 'success' || value === 'failure'
}

/**
 * Per-trust run result from the report workflow.
 * Auth: Bearer / x-api-key = REPORT_CONFIG_KEY.
 *
 * Body: { trust_id, report_type: 'daily'|'weekly', status: 'success'|'failure', error?, run_at? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  if (!rateLimit(req, res, { scope: 'report-runs', limit: 120, windowMs: 5 * 60_000 })) {
    return
  }

  if (!requireReportConfigKey(req, res)) return

  const body = (req.body ?? {}) as ReportRunBody

  if (!body.trust_id || typeof body.trust_id !== 'string') {
    return json(res, 400, { error: 'trust_id is required' })
  }
  if (!isReportType(body.report_type)) {
    return json(res, 400, { error: "report_type must be 'daily' or 'weekly'" })
  }
  if (!isRunStatus(body.status)) {
    return json(res, 400, { error: "status must be 'success' or 'failure'" })
  }

  let runAt = new Date().toISOString()
  if (body.run_at) {
    const parsed = new Date(body.run_at)
    if (Number.isNaN(parsed.getTime())) {
      return json(res, 400, { error: 'run_at must be a valid ISO timestamp' })
    }
    runAt = parsed.toISOString()
  }

  try {
    const db = getServiceClient()

    const { data: trust, error: trustError } = await db
      .from('trusts')
      .select('id')
      .eq('id', body.trust_id)
      .maybeSingle()

    if (trustError) {
      return json(res, 500, { error: trustError.message })
    }
    if (!trust) {
      return json(res, 404, { error: 'trust not found' })
    }

    const { data, error } = await db
      .from('report_runs')
      .insert({
        trust_id: body.trust_id,
        report_type: body.report_type,
        status: body.status,
        error: body.status === 'failure' ? (body.error ?? 'unknown') : null,
        run_at: runAt,
      })
      .select('id, trust_id, report_type, run_at, status, error')
      .single()

    if (error) {
      return json(res, 500, { error: error.message })
    }

    return json(res, 201, { run: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json(res, 500, { error: message })
  }
}
