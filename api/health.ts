import type { VercelRequest, VercelResponse } from '@vercel/node'
import { grafana, reportConfigKey, supabase } from './_lib/env.js'
import { json, methodNotAllowed } from './_lib/http.js'
import { getServiceClient } from './_lib/supabase.js'

export const config = {
  regions: ['lhr1'],
}

async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  if (!supabase.url() || !supabase.serviceRoleKey()) {
    return { ok: false, detail: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }
  }
  try {
    const db = getServiceClient()
    const { error } = await db.from('settings').select('key').limit(1)
    if (error) return { ok: false, detail: error.message }
    return { ok: true, detail: 'reachable' }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

async function checkGrafana(): Promise<{
  ok: boolean
  configured: boolean
  detail: string
}> {
  const token = grafana.token()
  if (!token) {
    return { ok: false, configured: false, detail: 'GRAFANA_TOKEN not set (fixtures mode)' }
  }

  const base = grafana.baseUrl().replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${base}/api/frontend/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, configured: true, detail: `token rejected (${response.status})` }
    }
    if (!response.ok) {
      return { ok: false, configured: true, detail: `HTTP ${response.status}` }
    }
    return { ok: true, configured: true, detail: 'reachable' }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      detail: error instanceof Error ? error.message : 'unreachable',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Uptime / readiness: DB required; Grafana checked when token is configured.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const [database, grafanaCheck] = await Promise.all([checkDatabase(), checkGrafana()])

  const checks = {
    database,
    grafana: grafanaCheck,
    reportConfigKey: Boolean(reportConfigKey()),
  }

  // App can run on fixtures without Grafana; DB is required for config/auth.
  const ready = database.ok

  return json(res, ready ? 200 : 503, {
    ok: ready,
    region: 'lhr1',
    checks,
  })
}
