import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReportConfigKey } from './_lib/auth.js'
import { json, methodNotAllowed } from './_lib/http.js'
import { rateLimit } from './_lib/rateLimit.js'
import { filterReportConfigTrusts } from './_lib/reportConfig.js'
import { getServiceClient } from './_lib/supabase.js'

export const config = {
  regions: ['lhr1'],
}

export type ReportConfigVan = {
  id: string
  instance: string
  display_name: string
  daily_enabled: boolean
  weekly_enabled: boolean
}

export type ReportConfigRecipient = {
  id: string
  name: string
  email: string
}

export type ReportConfigTrust = {
  id: string
  name: string
  slug: string
  daily_enabled: boolean
  weekly_enabled: boolean
  vans: ReportConfigVan[]
  recipients: ReportConfigRecipient[]
}

/**
 * Active trusts + vans (flags) + recipients for the report workflow.
 * Auth: Bearer / x-api-key = REPORT_CONFIG_KEY.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  if (!rateLimit(req, res, { scope: 'report-config', limit: 60, windowMs: 5 * 60_000 })) {
    return
  }

  if (!requireReportConfigKey(req, res)) return

  try {
    const db = getServiceClient()

    const { data: trusts, error: trustsError } = await db
      .from('trusts')
      .select(
        `
        id,
        name,
        slug,
        daily_enabled,
        weekly_enabled,
        active,
        vans (
          id,
          instance,
          display_name,
          daily_enabled,
          weekly_enabled,
          status
        ),
        recipients (
          id,
          name,
          email,
          active
        )
      `,
      )
      .eq('active', true)
      .order('name', { ascending: true })

    if (trustsError) {
      return json(res, 500, { error: trustsError.message })
    }

    const payload = {
      generated_at: new Date().toISOString(),
      trusts: filterReportConfigTrusts(trusts ?? []),
    }

    await db.from('settings').upsert(
      {
        key: 'report_config_last_ok',
        value: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )

    return json(res, 200, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json(res, 500, { error: message })
  }
}
