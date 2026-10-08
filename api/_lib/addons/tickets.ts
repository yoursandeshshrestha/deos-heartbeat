export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed' | 'unknown'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent' | 'unknown'

export type TicketVan = {
  instance: string
  display_name: string
  trust_slug: string | null
}

export type SupportTicket = {
  id: number
  subject: string
  status: TicketStatus
  priority: TicketPriority
  requester: string | null
  source: string | null
  assignee: string | null
  trust_slug: string | null
  instance: string | null
  created_at: string | null
  updated_at: string | null
  url: string | null
}

const STATUS: Record<number, TicketStatus> = {
  2: 'open',
  3: 'pending',
  4: 'resolved',
  5: 'closed',
}

const PRIORITY: Record<number, TicketPriority> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'urgent',
}

const SOURCE: Record<number, string> = {
  1: 'Email',
  2: 'Portal',
  3: 'Phone',
  7: 'Chat',
  9: 'Feedback widget',
  10: 'Outbound email',
}

export function freshdeskStatus(value: number): TicketStatus {
  return STATUS[value] ?? 'unknown'
}

export function freshdeskPriority(value: number): TicketPriority {
  return PRIORITY[value] ?? 'unknown'
}

export function freshdeskSource(value: number) {
  return SOURCE[value] ?? null
}

export function ticketUrl(domain: string, id: number) {
  const host = domain.includes('.') ? domain : `${domain}.freshdesk.com`
  return `https://${host.replace(/^https?:\/\//, '')}/a/tickets/${id}`
}

/** Match Jo and other tickets that name a van. Otherwise leave unassigned. */
export function matchTicketVan(text: string, vans: TicketVan[]): TicketVan | null {
  const hay = text.toLowerCase()
  const byInstance = vans
    .filter((van) => hay.includes(van.instance.toLowerCase()))
    .sort((a, b) => b.instance.length - a.instance.length)
  if (byInstance[0]) return byInstance[0]
  const byName = vans.filter((van) => {
    const name = van.display_name.trim().toLowerCase()
    return name.length >= 4 && hay.includes(name)
  })
  return byName[0] ?? null
}

export function ticketSearchText(ticket: {
  subject?: string | null
  description_text?: string | null
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
}) {
  const custom = ticket.custom_fields
    ? Object.values(ticket.custom_fields)
        .filter((value) => value != null)
        .map((value) => String(value))
        .join(' ')
    : ''
  return [ticket.subject ?? '', ticket.description_text ?? '', ...(ticket.tags ?? []), custom].join(
    '\n',
  )
}
