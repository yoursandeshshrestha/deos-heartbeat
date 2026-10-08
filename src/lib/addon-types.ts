export type Figures = {
  patients: number
  worklist: number
  studies: number
  completion: number | null
  syncSpeed: number | null
  syncFailed: number
  syncComplete: number
  uptimePct: number | null
  offlineMinutes: number
}

export type InsightsPayload = {
  range: string
  from: string
  to: string
  compareFrom: string | null
  compareTo: string | null
  headline: string | null
  current: Figures
  previous: Figures | null
  trusts: Array<{ slug: string; figures: Figures }>
  vans: Array<{
    instance: string
    displayName: string
    trust: string | null
    status: string | null
    figures: Figures
  }>
  series: Array<{ date: string; patients: number; worklist: number }>
  calendar: Array<{ date: string; status: string | null; moved: boolean }>
  notice?: string
}

export type LocationPayload = {
  date: string
  points: Array<{
    latitude: number
    longitude: number
    accuracy_m: number | null
    status: string | null
    recorded_at: string
  }>
  timeline: Array<{
    kind: 'stay' | 'move'
    from: string
    to: string
    latitude: number
    longitude: number
    endLatitude: number | null
    endLongitude: number | null
    status: string | null
  }>
  visits: Array<{
    latitude: number
    longitude: number
    from: string
    to: string
    days: number
  }>
  notice?: string
}

export type SupportTicket = {
  id: number
  subject: string
  status: string
  priority: string
  requester: string | null
  source: string | null
  assignee: string | null
  trust_slug: string | null
  instance: string | null
  created_at: string | null
  updated_at: string | null
  url: string | null
}

export type TicketsPayload = {
  configured: boolean
  notice: string | null
  counts: { open: number; pending: number; urgent: number }
  tickets: SupportTicket[]
  vans: Array<{ instance: string; display_name: string; trust_slug: string | null }>
}

export type EngagementPayload = {
  sent: number
  opened: number
  openRate: number | null
  previousSent: number
  previousOpened: number
  previousOpenRate: number | null
  trend: Array<{ week: string; sent: number; opened: number; openRate: number | null }>
  trusts: Array<{
    trustId: string
    trustName: string
    recipients: number
    sent: number
    opened: number
    openRate: number | null
    quiet: number
    lastOpened: string | null
  }>
  recipients: Array<{
    recipientId: string | null
    email: string
    name: string | null
    trustId: string
    trustName: string
    active: boolean
    sent: number
    opened: number
    openRate: number | null
    lastOpened: string | null
    quiet: boolean
  }>
  reports: Array<{
    batchId: string
    trustId: string
    trustName: string
    reportType: 'daily' | 'weekly'
    sentAt: string
    sent: number
    opened: number
    openRate: number | null
    opens: Array<{ email: string; openedAt: string | null }>
  }>
  notice?: string
}
