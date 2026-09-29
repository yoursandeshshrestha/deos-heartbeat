import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from './_lib/auth.js'
import { json, methodNotAllowed, refuseVercelFunction } from './_lib/http.js'
import { rateLimit } from './_lib/rateLimit.js'
import {
  createUser,
  isRole,
  listUsers,
  updateUser,
} from './_lib/users/manage.js'

export const config = {
  regions: ['lhr1'],
}

/**
 * Admin user management.
 * GET  — list profiles
 * POST — create auth user + profile
 * PATCH — update role / full_name (blocks removing the last admin)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (refuseVercelFunction(res)) return
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
    return methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
  }

  if (!rateLimit(req, res, { scope: 'users', limit: 60, windowMs: 5 * 60_000 })) {
    return
  }

  if (!(await requireAdmin(req, res))) return

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    if (req.method === 'GET') {
      return json(res, 200, { users: await listUsers() })
    }

    if (req.method === 'POST') {
      const role = body.role
      if (!isRole(role)) {
        return json(res, 400, { error: "role must be 'admin' or 'viewer'" })
      }
      const user = await createUser({
        email: typeof body.email === 'string' ? body.email : '',
        fullName: typeof body.full_name === 'string' ? body.full_name : '',
        password: typeof body.password === 'string' ? body.password : '',
        role,
      })
      return json(res, 201, { user })
    }

    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return json(res, 400, { error: 'id is required' })
    if (body.role !== undefined && !isRole(body.role)) {
      return json(res, 400, { error: "role must be 'admin' or 'viewer'" })
    }

    const user = await updateUser({
      id,
      role: isRole(body.role) ? body.role : undefined,
      fullName: typeof body.full_name === 'string' ? body.full_name : undefined,
    })
    return json(res, 200, { user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'user not found') return json(res, 404, { error: message })
    if (
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('Cannot demote') ||
      message.includes('password')
    ) {
      return json(res, 400, { error: message })
    }
    return json(res, 500, { error: message })
  }
}
