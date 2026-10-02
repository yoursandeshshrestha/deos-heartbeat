import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronOrAdmin } from '../_lib/auth.js'
import { json, methodNotAllowed, refuseVercelFunction } from '../_lib/http.js'
import { rateLimit } from '../_lib/rateLimit.js'
import type { ReportType } from '../_lib/reports/buildTrustReport.js'
import { sendTrustReports } from '../_lib/reports/sendTrustReports.js'

export const config = {
  regions: ['lhr1'],
  maxDuration: 60,
}

type SendBody = {
  report_type?: string
  trust_id?: string
  dry_run?: boolean
}

function isReportType(value: unknown): value is ReportType {
  return value === 'daily' || value === 'weekly'
}

async function sendTrustReportsRetrying(input: {
  reportType: ReportType
  trustId?: string
  dryRun: boolean
}) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await sendTrustReports(input)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('JWT issued at future') || attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError
}

function readQueryFlag(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) return value.some((v) => v === '1' || v === 'true')
  return value === '1' || value === 'true'
}

function readParam(
  req: VercelRequest,
  body: SendBody,
  key: 'report_type' | 'trust_id',
): string | undefined {
  const fromBody = body[key]
  if (typeof fromBody === 'string' && fromBody) return fromBody
  const raw = req.query[key]
  if (typeof raw === 'string' && raw) return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

/**
 * Send daily/weekly trust fleet report emails via Resend.
 * Auth: Bearer CRON_SECRET (Vercel Cron) or admin Supabase access token.
 *
 * Query/body: report_type=daily|weekly, optional trust_id, optional dry_run.
 * Accepts GET (Vercel Cron) and POST (admin UI).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (!rateLimit(req, res, { scope: 'reports-send', limit: 30, windowMs: 5 * 60_000 })) {
    return
  }

  if (!(await requireCronOrAdmin(req, res))) return

  const body = (req.body ?? {}) as SendBody
  const reportTypeRaw = readParam(req, body, 'report_type')
  if (!isReportType(reportTypeRaw)) {
    return json(res, 400, { error: "report_type must be 'daily' or 'weekly'" })
  }
  const trustId = readParam(req, body, 'trust_id')
  const dryRun =
    typeof body.dry_run === 'boolean'
      ? body.dry_run
      : readQueryFlag(req.query.dry_run)

  try {
    const summary = await sendTrustReportsRetrying({
      reportType: reportTypeRaw,
      trustId,
      dryRun,
    })
    return json(res, 200, summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'trust not found') {
      return json(res, 404, { error: message })
    }
    return json(res, 500, { error: message })
  }
}
