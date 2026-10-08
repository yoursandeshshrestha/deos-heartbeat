import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireReader } from './_lib/auth.js'
import { buildEngagement, type DeliveryRow } from './_lib/addons/engagement.js'
import { supabase as supabaseEnv } from './_lib/env.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { getServiceClient } from './_lib/supabase.js'

export const config = { regions: ['lhr1'], maxDuration: 20 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const reader = await requireReader(req, res)
  if (!reader) return
  if (!supabaseEnv.url() || !supabaseEnv.serviceRoleKey()) {
    return json(res, 200, empty('Database is not configured'))
  }

  try {
    const db = getServiceClient()
    const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const rows: DeliveryRow[] = []
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db
        .from('report_deliveries')
        .select(
          'id, trust_id, recipient_id, report_type, batch_id, email, resend_id, sent_at, opened_at, trusts(name), recipients(name, active)',
        )
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .range(start, start + 999)
      if (error) throw new Error(error.message)
      const page = data ?? []
      for (const row of page) {
        const trust = row.trusts as { name?: string } | { name?: string }[] | null
        const recipient = row.recipients as
          | { name?: string; active?: boolean }
          | { name?: string; active?: boolean }[]
          | null
        const trustRow = Array.isArray(trust) ? trust[0] : trust
        const recipientRow = Array.isArray(recipient) ? recipient[0] : recipient
        rows.push({
          id: row.id as string,
          trust_id: row.trust_id as string,
          trust_name: trustRow?.name ?? 'Trust',
          recipient_id: (row.recipient_id as string | null) ?? null,
          recipient_name: recipientRow?.name ?? null,
          email: row.email as string,
          active: recipientRow?.active ?? true,
          report_type: row.report_type as 'daily' | 'weekly',
          batch_id: row.batch_id as string,
          resend_id: (row.resend_id as string | null) ?? null,
          sent_at: row.sent_at as string,
          opened_at: (row.opened_at as string | null) ?? null,
        })
      }
      if (page.length < 1000) break
    }
    return json(res, 200, {
      ...buildEngagement(rows),
      notice:
        'Opens are detected when an email client loads the message. Some systems, including NHSmail, block that, and some open mail automatically. Treat the rate as a signal, not an exact count. The Wednesday Email Tracking report stays on its existing automation.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load engagement'
    return json(res, 200, empty(message))
  }
}

function empty(notice: string) {
  return {
    sent: 0,
    opened: 0,
    openRate: null,
    previousSent: 0,
    previousOpened: 0,
    previousOpenRate: null,
    trend: [],
    trusts: [],
    recipients: [],
    reports: [],
    notice,
  }
}
