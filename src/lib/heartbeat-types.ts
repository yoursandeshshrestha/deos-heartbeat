export type VanStatus = 'active' | 'paused' | 'unassigned' | 'removed'

export type Trust = {
  id: string
  name: string
  slug: string
  daily_enabled: boolean
  weekly_enabled: boolean
  active: boolean
  created_at: string
}

export type Van = {
  id: string
  trust_id: string | null
  instance: string
  display_name: string
  modality_target: string | null
  daily_enabled: boolean
  weekly_enabled: boolean
  speed_floor: string | null
  status: VanStatus
  created_at: string
}

export type Recipient = {
  id: string
  trust_id: string
  name: string
  email: string
  active: boolean
  created_at: string
}

export type TrustWithRelations = Trust & {
  vans: Van[]
  recipients: Recipient[]
}

export type AuditEntry = {
  id: string
  at: string
  user_id: string | null
  action: string
  entity: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
