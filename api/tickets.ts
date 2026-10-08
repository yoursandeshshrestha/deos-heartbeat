import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, requireReader } from './_lib/auth.js'
import {
  freshdeskConfigured,
  lastTicketSync,
  linkTicket,
  listTickets,
  loadVansForLink,
  syncDue,
  syncFreshdeskTickets,
} from './_lib/addons/freshdesk.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { getServiceClient } from './_lib/supabase.js'

export const config = { regions: ['lhr1'], maxDuration: 30 }

function queryValue(req: VercelRequest, name: string) {
  const value = req.query[name]
  return typeof value === 'string' ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method === 'POST') return link(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'POST'])
  const reader = await requireReader(req, res)
  if (!reader) return

  const configured = freshdeskConfigured()
  let notice: string | null = null
  if (configured && syncDue(await lastTicketSync().catch(() => null))) {
    try {
      await syncFreshdeskTickets()
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Freshdesk sync failed'
    }
  }

  try {
    const tickets = await listTickets()
    const trust = queryValue(req, 'trust')
    const status = queryValue(req, 'status') ?? 'open'
    const scoped = trust ? tickets.filter((ticket) => ticket.trust_slug === trust) : tickets
    const counts = {
      open: scoped.filter((ticket) => ticket.status === 'open').length,
      pending: scoped.filter((ticket) => ticket.status === 'pending').length,
      urgent: scoped.filter(
        (ticket) =>
          ticket.priority === 'urgent' &&
          (ticket.status === 'open' || ticket.status === 'pending'),
      ).length,
    }
    const visible = scoped.filter((ticket) => {
      if (status === 'all') return true
      if (status === 'resolved') return ticket.status === 'resolved' || ticket.status === 'closed'
      if (status === 'open') return ticket.status === 'open' || ticket.status === 'pending'
      return ticket.status === status
    })
    return json(res, 200, {
      configured,
      notice,
      counts,
      tickets: visible,
      vans: await loadVansForLink().catch(() => []),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load tickets'
    return json(res, 200, {
      configured,
      notice: message,
      counts: { open: 0, pending: 0, urgent: 0 },
      tickets: [],
      vans: [],
    })
  }
}

async function link(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const body = (req.body ?? {}) as { id?: unknown; instance?: unknown }
  const id = Number(body.id)
  if (!Number.isFinite(id)) return json(res, 400, { error: 'id is required' })
  const instance = typeof body.instance === 'string' && body.instance ? body.instance : null
  try {
    await linkTicket(id, instance)
    try {
      const db = getServiceClient()
      await db.from('audit_log').insert({
        user_id: admin.userId,
        action: 'update',
        entity: 'support_tickets',
        entity_id: null,
        before: null,
        after: { id, instance },
      })
    } catch {
      // The link is saved. Audit is best-effort.
    }
    return json(res, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not link ticket'
    const status = message === 'van not found' ? 404 : 400
    return json(res, status, { error: message })
  }
}
