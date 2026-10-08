import { requireReader } from '../../../api/_lib/auth.ts'
import fleet from '../../../api/fleet.ts'
import fleetSummary from '../../../api/fleet-summary.ts'
import generatedReports from '../../../api/generated-reports.ts'
import health from '../../../api/health.ts'
import reportConfig from '../../../api/report-config.ts'
import reportRuns from '../../../api/report-runs.ts'
import reportsSend from '../../../api/reports/send.ts'
import users from '../../../api/users.ts'
import insights from '../../../api/insights.ts'
import locations from '../../../api/locations.ts'
import tickets from '../../../api/tickets.ts'
import engagement from '../../../api/engagement.ts'
import resendWebhook from '../../../api/webhooks/resend.ts'

type Handler = (req: never, res: never) => Promise<unknown> | unknown

const routes: Record<string, Handler> = {
  fleet: fleet as Handler,
  'fleet-summary': fleetSummary as Handler,
  health: health as Handler,
  'reports/send': reportsSend as Handler,
  'generated-reports': generatedReports as Handler,
  users: users as Handler,
  'report-config': reportConfig as Handler,
  'report-runs': reportRuns as Handler,
  insights: insights as Handler,
  locations: locations as Handler,
  tickets: tickets as Handler,
  engagement: engagement as Handler,
  'webhooks/resend': resendWebhook as Handler,
}

const readerRoutes = new Set(['fleet', 'fleet-summary'])

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}

function routeOf(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts.lastIndexOf('api')
  return (marker >= 0 ? parts.slice(marker + 1) : []).join('/')
}

function adapt(request: Request) {
  const url = new URL(request.url)
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as BodyInit | null,
  }

  const res = {
    get statusCode() {
      return state.statusCode
    },
    set statusCode(code: number) {
      state.statusCode = code
    },
    setHeader(name: string, value: string | number) {
      state.headers[name] = String(value)
    },
    getHeader(name: string) {
      return state.headers[name]
    },
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(payload: unknown) {
      state.headers['content-type'] = 'application/json; charset=utf-8'
      state.body = JSON.stringify(payload)
      return res
    },
    send(payload: unknown) {
      if (payload instanceof Uint8Array) {
        state.body = payload
        return res
      }
      if (typeof payload === 'string') {
        state.body = payload
        return res
      }
      state.headers['content-type'] = 'application/json; charset=utf-8'
      state.body = JSON.stringify(payload ?? null)
      return res
    },
    end(payload?: unknown) {
      if (payload !== undefined) res.send(payload)
    },
  }

  const req = {
    method: request.method,
    headers,
    query,
    url: url.pathname + url.search,
    body: undefined as unknown,
    rawBody: undefined as string | undefined,
    socket: { remoteAddress: headers['x-forwarded-for'] ?? '' },
  }

  return {
    req,
    res,
    async readBody() {
      if (request.method === 'GET' || request.method === 'HEAD') return
      const text = await request.text()
      if (!text) return
      req.rawBody = text
      try {
        req.body = JSON.parse(text)
      } catch {
        req.body = text
      }
    },
    toResponse() {
      return new Response(state.body, {
        status: state.statusCode,
        headers: { ...corsHeaders, ...state.headers },
      })
    },
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const route = routeOf(url)
  const handler = routes[route]
  const adapted = adapt(request)
  if (!handler) {
    adapted.res.status(404).json({ error: 'Not found' })
    return adapted.toResponse()
  }

  try {
    await adapted.readBody()
    if (readerRoutes.has(route)) {
      const reader = await requireReader(adapted.req as never, adapted.res as never)
      if (!reader) return adapted.toResponse()
    }
    await handler(adapted.req as never, adapted.res as never)
    return adapted.toResponse()
  } catch (error) {
    adapted.res.status(500).json({
      error: error instanceof Error ? error.message : 'Edge function error',
    })
    return adapted.toResponse()
  }
})
