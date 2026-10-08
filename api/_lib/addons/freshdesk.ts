import type { VercelRequest, VercelResponse } from '@vercel/node'
import { optionalEnv } from '../env.js'
import { getServiceClient } from '../supabase.js'
import {
  freshdeskPriority,
  freshdeskSource,
  freshdeskStatus,
  matchTicketVan,
  ticketSearchText,
  ticketUrl,
  type SupportTicket,
  type TicketVan,
} from './tickets.js'

const SYNC_MS = 15 * 60 * 1000
const MAX_PAGES = 5

type FreshdeskTicket = {
  id: number
  subject?: string
  description_text?: string
  status?: number
  priority?: number
  source?: number
  requester?: { name?: string; email?: string } | null
  responder_id?: number | null
  tags?: string[]
  custom_fields?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export function freshdeskConfigured() {
  return Boolean(optionalEnv('FRESHDESK_DOMAIN') && optionalEnv('FRESHDESK_API_KEY'))
}

function authHeader() {
  const key = optionalEnv('FRESHDESK_API_KEY') ?? ''
  return `Basic ${Buffer.from(`${key}:X`).toString('base64')}`
}

function domainHost() {
  const domain = optionalEnv('FRESHDESK_DOMAIN') ?? ''
  return domain.includes('.') ? domain.replace(/^https?:\/\//, '') : `${domain}.freshdesk.com`
}

async function freshdeskGet<T>(path: string): Promise<T> {
  const response = await fetch(`https://${domainHost()}${path}`, {
    headers: { Authorization: authHeader() },
  })
  if (!response.ok) {
    throw new Error(`Freshdesk ${response.status}`)
  }
  return (await response.json()) as T
}

export async function loadVansForLink(): Promise<TicketVan[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('vans')
    .select('instance, display_name, trusts(slug)')
    .neq('status', 'removed')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const trust = row.trusts as { slug?: string } | { slug?: string }[] | null
    const slug = Array.isArray(trust) ? trust[0]?.slug : trust?.slug
    return {
      instance: row.instance as string,
      display_name: row.display_name as string,
      trust_slug: slug ?? null,
    }
  })
}

async function agentNames() {
  const map = new Map<number, string>()
  try {
    const agents = await freshdeskGet<Array<{ id: number; contact?: { name?: string } }>>(
      '/api/v2/agents',
    )
    for (const agent of agents) {
      if (agent.contact?.name) map.set(agent.id, agent.contact.name)
    }
  } catch {
    // Assignee names are optional. Tickets still sync.
  }
  return map
}

export async function syncFreshdeskTickets() {
  if (!freshdeskConfigured()) return { configured: false as const, synced: 0 }
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const [vans, agents] = await Promise.all([loadVansForLink(), agentNames()])
  const tickets: FreshdeskTicket[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      updated_since: since,
      include: 'description',
    })
    const batch = await freshdeskGet<FreshdeskTicket[]>(`/api/v2/tickets?${params}`)
    tickets.push(...batch)
    if (batch.length < 100) break
  }

  const rows = tickets.map((ticket) => {
    const match = matchTicketVan(ticketSearchText(ticket), vans)
    const requester = ticket.requester?.name || ticket.requester?.email || null
    return {
      id: ticket.id,
      subject: ticket.subject || `Ticket ${ticket.id}`,
      status: freshdeskStatus(ticket.status ?? 0),
      priority: freshdeskPriority(ticket.priority ?? 0),
      requester,
      source: freshdeskSource(ticket.source ?? 0),
      assignee: ticket.responder_id ? (agents.get(ticket.responder_id) ?? null) : null,
      trust_slug: match?.trust_slug ?? null,
      instance: match?.instance ?? null,
      created_at: ticket.created_at ?? null,
      updated_at: ticket.updated_at ?? null,
      url: ticketUrl(domainHost(), ticket.id),
      synced_at: new Date().toISOString(),
    }
  })

  const db = getServiceClient()
  if (rows.length) {
    const { error } = await db.from('support_tickets').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  await db.from('settings').upsert({
    key: 'freshdesk_synced_at',
    value: { at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  })
  return { configured: true as const, synced: rows.length }
}

export async function lastTicketSync() {
  const db = getServiceClient()
  const { data } = await db
    .from('settings')
    .select('value')
    .eq('key', 'freshdesk_synced_at')
    .maybeSingle()
  const at = (data?.value as { at?: string } | null)?.at
  return at ?? null
}

export function syncDue(syncedAt: string | null) {
  if (!syncedAt) return true
  return Date.now() - new Date(syncedAt).getTime() > SYNC_MS
}

export async function listTickets(): Promise<SupportTicket[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('support_tickets')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as SupportTicket[]
}

export async function linkTicket(id: number, instance: string | null) {
  const db = getServiceClient()
  let trust: string | null = null
  if (instance) {
    const { data, error } = await db
      .from('vans')
      .select('instance, trusts(slug)')
      .eq('instance', instance)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('van not found')
    const joined = data.trusts as { slug?: string } | { slug?: string }[] | null
    trust = Array.isArray(joined) ? (joined[0]?.slug ?? null) : (joined?.slug ?? null)
  }
  const { error } = await db
    .from('support_tickets')
    .update({ instance, trust_slug: trust })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export function readQuery(req: VercelRequest, name: string) {
  const value = req.query[name]
  return typeof value === 'string' ? value : null
}

export function readRawBody(req: VercelRequest) {
  const raw = (req as VercelRequest & { rawBody?: string }).rawBody
  if (typeof raw === 'string') return raw
  if (typeof req.body === 'string') return req.body
  return JSON.stringify(req.body ?? {})
}
