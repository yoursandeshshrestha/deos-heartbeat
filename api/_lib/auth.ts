import type { VercelRequest, VercelResponse } from '@vercel/node'
import { optionalEnv, reportConfigKey } from './env.js'
import { json, readBearer } from './http.js'
import { getServiceClient } from './supabase.js'

/** Static API key for report workflow endpoints. */
export function requireReportConfigKey(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const expected = reportConfigKey()
  if (!expected) {
    json(res, 503, { error: 'REPORT_CONFIG_KEY not configured' })
    return false
  }

  const provided =
    readBearer(req) ??
    (typeof req.headers['x-api-key'] === 'string'
      ? req.headers['x-api-key']
      : null)

  if (!provided || provided !== expected) {
    json(res, 401, { error: 'Unauthorized' })
    return false
  }

  return true
}

export type AdminIdentity = {
  userId: string
  role: 'admin'
}

export type ReaderIdentity = {
  userId: string
  role: 'admin' | 'viewer'
}

/** Verify Bearer is a signed-in admin or viewer. Returns identity or writes 401/403. */
export async function requireReader(
  req: VercelRequest,
  res: VercelResponse,
): Promise<ReaderIdentity | null> {
  const bearer = readBearer(req)
  if (!bearer) {
    json(res, 401, { error: 'Unauthorized' })
    return null
  }

  try {
    const db = getServiceClient()
    const { data, error } = await db.auth.getUser(bearer)
    if (error || !data.user) {
      json(res, 401, { error: 'Unauthorized' })
      return null
    }

    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin' && profile?.role !== 'viewer') {
      json(res, 403, { error: 'Forbidden' })
      return null
    }

    return { userId: data.user.id, role: profile.role }
  } catch {
    json(res, 401, { error: 'Unauthorized' })
    return null
  }
}

/** Verify Bearer is a Supabase admin session. Returns identity or writes 401/403. */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AdminIdentity | null> {
  const bearer = readBearer(req)
  if (!bearer) {
    json(res, 401, { error: 'Unauthorized' })
    return null
  }

  try {
    const db = getServiceClient()
    const { data, error } = await db.auth.getUser(bearer)
    if (error || !data.user) {
      json(res, 401, { error: 'Unauthorized' })
      return null
    }

    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      json(res, 403, { error: 'Admin only' })
      return null
    }

    return { userId: data.user.id, role: 'admin' }
  } catch {
    json(res, 401, { error: 'Unauthorized' })
    return null
  }
}

function readCronHeader(req: VercelRequest): string | null {
  const header = req.headers['x-cron-secret']
  if (typeof header === 'string' && header.trim()) return header.trim()
  return null
}

/**
 * Auth for report send: `x-cron-secret` (pg_cron) or an admin Supabase session JWT.
 * The cron secret stays off `Authorization` so the edge gateway does not treat it as a JWT.
 */
export async function requireCronOrAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  const cronSecret = optionalEnv('CRON_SECRET')
  const presented = readCronHeader(req) ?? readBearer(req)

  if (cronSecret && presented === cronSecret) {
    return true
  }

  return Boolean(await requireAdmin(req, res))
}
