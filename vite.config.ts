import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { ACCOUNTS } from './src/lib/accounts'

function localApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          next()
          return
        }

        for (const [key, value] of Object.entries(env)) {
          if (process.env[key] == null) process.env[key] = value
        }

        try {
          const pathOnly = req.url.split('?')[0] ?? req.url

          if (pathOnly === '/api/fleet-summary') {
            const url = new URL(req.url, 'http://localhost')
            const trust = url.searchParams.get('trust') || 'all'
            const name = url.searchParams.get('name') || ''
            const { buildFleetPayload } = await server.ssrLoadModule(
              '/api/_lib/fleet/build.ts',
            )
            const {
              buildFleetBriefingFacts,
              buildFleetBriefing,
              briefingCacheKey,
              getCachedBriefing,
              setCachedBriefing,
            } = await server.ssrLoadModule('/api/_lib/fleet/briefing.ts')
            const fleet = await buildFleetPayload()
            const facts = buildFleetBriefingFacts(fleet, trust)
            const key = briefingCacheKey(facts, name)
            const cached = getCachedBriefing(key)
            if (cached) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  ...cached,
                  cached: true,
                  facts,
                }),
              )
              return
            }
            const briefing = buildFleetBriefing(facts, name)
            setCachedBriefing(key, briefing)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ...briefing,
                cached: false,
                facts,
              }),
            )
            return
          }

          if (pathOnly === '/api/fleet') {
            const { buildFleetPayload } = await server.ssrLoadModule(
              '/api/_lib/fleet/build.ts',
            )
            const payload = await buildFleetPayload()
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
            return
          }

          if (pathOnly === '/api/health') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: true,
                region: 'local',
                checks: {
                  supabaseUrl: Boolean(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
                  supabaseServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
                  grafanaToken: Boolean(env.GRAFANA_TOKEN),
                  reportConfigKey: Boolean(env.REPORT_CONFIG_KEY),
                  resendApiKey: Boolean(env.RESEND_API_KEY),
                },
              }),
            )
            return
          }

          async function requireLocalAdmin(): Promise<boolean> {
            const auth = req.headers.authorization
            if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return false
            const token = auth.slice(7).trim()
            const { getServiceClient } = await server.ssrLoadModule(
              '/api/_lib/supabase.ts',
            )
            const db = getServiceClient()
            const { data, error } = await db.auth.getUser(token)
            if (error || !data.user) return false
            const { data: profile } = await db
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .maybeSingle()
            return profile?.role === 'admin'
          }

          async function requireLocalReader(): Promise<boolean> {
            const auth = req.headers.authorization
            if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return false
            const token = auth.slice(7).trim()
            const { getServiceClient } = await server.ssrLoadModule(
              '/api/_lib/supabase.ts',
            )
            const db = getServiceClient()
            const { data, error } = await db.auth.getUser(token)
            if (error || !data.user) return false
            const { data: profile } = await db
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .maybeSingle()
            return profile?.role === 'admin' || profile?.role === 'viewer'
          }

          async function readJsonBody(): Promise<Record<string, unknown>> {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            if (!raw) return {}
            try {
              return JSON.parse(raw) as Record<string, unknown>
            } catch {
              return {}
            }
          }

          if (req.url.startsWith('/api/users')) {
            if (!(await requireLocalAdmin())) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unauthorized' }))
              return
            }

            const { listUsers, createUser, updateUser, isRole } =
              await server.ssrLoadModule('/api/_lib/users/manage.ts')

            if (req.method === 'GET') {
              const users = await listUsers()
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ users }))
              return
            }

            const body = await readJsonBody()

            if (req.method === 'POST') {
              if (!isRole(body.role)) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: "role must be 'admin' or 'viewer'" }))
                return
              }
              try {
                const user = await createUser({
                  email: typeof body.email === 'string' ? body.email : '',
                  fullName: typeof body.full_name === 'string' ? body.full_name : '',
                  password: typeof body.password === 'string' ? body.password : '',
                  role: body.role,
                })
                res.statusCode = 201
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ user }))
              } catch (error) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: error instanceof Error ? error.message : 'Create failed',
                  }),
                )
              }
              return
            }

            if (req.method === 'PATCH') {
              try {
                const user = await updateUser({
                  id: typeof body.id === 'string' ? body.id : '',
                  role: isRole(body.role) ? body.role : undefined,
                  fullName:
                    typeof body.full_name === 'string' ? body.full_name : undefined,
                })
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ user }))
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Update failed'
                res.statusCode = message === 'user not found' ? 404 : 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: message }))
              }
              return
            }

            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          if (req.url?.startsWith('/api/generated-reports')) {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            if (!(await requireLocalReader())) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unauthorized' }))
              return
            }

            const fileUrl = new URL(req.url, 'http://localhost')
            const { readGeneratedReportPdf } = await server.ssrLoadModule(
              '/api/_lib/reports/storeGeneratedReport.ts',
            )
            const file = await readGeneratedReportPdf(fileUrl.searchParams.get('id') ?? '')
            if (!file) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Report not found' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`)
            res.setHeader('Cache-Control', 'private, no-store')
            res.end(Buffer.from(file.bytes))
            return
          }

          const addonModules: Record<string, string> = {
            '/api/insights': '/api/insights.ts',
            '/api/locations': '/api/locations.ts',
            '/api/tickets': '/api/tickets.ts',
            '/api/engagement': '/api/engagement.ts',
            '/api/webhooks/resend': '/api/webhooks/resend.ts',
          }
          const addonModule = addonModules[pathOnly]
          if (addonModule) {
            const isWebhook = pathOnly === '/api/webhooks/resend'
            if (!isWebhook && !(await requireLocalReader())) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unauthorized' }))
              return
            }
            const chunks: Buffer[] = []
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
            }
            const rawBody = Buffer.concat(chunks).toString('utf8')
            let parsedBody: unknown
            if (rawBody) {
              try {
                parsedBody = JSON.parse(rawBody)
              } catch {
                parsedBody = rawBody
              }
            }
            const addonUrl = new URL(req.url ?? pathOnly, 'http://localhost')
            const query: Record<string, string> = {}
            addonUrl.searchParams.forEach((value, key) => {
              query[key] = value
            })
            const headers: Record<string, string> = {}
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers[key.toLowerCase()] = value
            }
            const state = {
              statusCode: 200,
              headers: {} as Record<string, string>,
              payload: '',
            }
            const fakeRes = {
              setHeader(name: string, value: string | number) {
                state.headers[name] = String(value)
                return fakeRes
              },
              getHeader(name: string) {
                return state.headers[name]
              },
              status(code: number) {
                state.statusCode = code
                return fakeRes
              },
              json(payload: unknown) {
                state.headers['content-type'] = 'application/json; charset=utf-8'
                state.payload = JSON.stringify(payload)
                return fakeRes
              },
              send(payload: unknown) {
                state.payload =
                  typeof payload === 'string' ? payload : JSON.stringify(payload ?? null)
                return fakeRes
              },
              end(payload?: unknown) {
                if (payload !== undefined) fakeRes.send(payload)
              },
            }
            const mod = await server.ssrLoadModule(addonModule)
            await mod.default(
              {
                method: req.method,
                headers,
                query,
                url: addonUrl.pathname + addonUrl.search,
                body: parsedBody,
                rawBody,
                socket: { remoteAddress: '' },
              },
              fakeRes,
            )
            res.statusCode = state.statusCode
            for (const [key, value] of Object.entries(state.headers)) {
              res.setHeader(key, value)
            }
            res.end(state.payload)
            return
          }

          if (req.url.startsWith('/api/reports/send')) {
            const url = new URL(req.url, 'http://localhost')
            const body = await readJsonBody()

            const auth = req.headers.authorization
            const cronSecret = env.CRON_SECRET
            let authorized = Boolean(cronSecret && auth === `Bearer ${cronSecret}`)
            if (!authorized) {
              authorized = await requireLocalAdmin()
            }
            if (!authorized) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unauthorized' }))
              return
            }

            const reportType =
              (typeof body.report_type === 'string' && body.report_type) ||
              url.searchParams.get('report_type')
            if (reportType !== 'daily' && reportType !== 'weekly') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: "report_type must be 'daily' or 'weekly'",
                }),
              )
              return
            }

            const { sendTrustReports } = await server.ssrLoadModule(
              '/api/_lib/reports/sendTrustReports.ts',
            )
            const summary = await sendTrustReports({
              reportType,
              trustId:
                (typeof body.trust_id === 'string' && body.trust_id) ||
                url.searchParams.get('trust_id') ||
                undefined,
              dryRun:
                typeof body.dry_run === 'boolean'
                  ? body.dry_run
                  : url.searchParams.get('dry_run') === '1' ||
                    url.searchParams.get('dry_run') === 'true',
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summary))
            return
          }
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Local API error',
            }),
          )
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const env = loadEnv('', process.cwd(), '')
  const devLogin = command === 'serve'
  const devPassword = env.SEED_ADMIN_PASSWORD || 'ukdeosXthrumble'
  const devLogins = devLogin
    ? ACCOUNTS.map((account) => ({ label: account.label, email: account.email }))
    : []

  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
    define: {
      __DEV_LOGIN_PASSWORD__: JSON.stringify(devLogin ? devPassword : ''),
      __DEV_LOGINS__: JSON.stringify(devLogins),
      // Temporary: skip the authenticator code in every build, including production.
      __BYPASS_AUTHENTICATOR__: JSON.stringify(true),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
