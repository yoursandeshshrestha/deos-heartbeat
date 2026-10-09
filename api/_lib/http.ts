import type { VercelRequest, VercelResponse } from '@vercel/node'

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '))
  return res.status(405).json({ error: 'Method not allowed' })
}

export function readBearer(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

export function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

/** Kept so existing handlers can call it. Routes run on Vercel. */
export function refuseVercelFunction(_res: VercelResponse): boolean {
  return false
}
