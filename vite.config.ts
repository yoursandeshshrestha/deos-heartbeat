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
          if (req.url.startsWith('/api/fleet')) {
            const { buildFleetPayload } = await server.ssrLoadModule(
              '/api/_lib/fleet/build.ts',
            )
            const payload = await buildFleetPayload()
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
            return
          }

          if (req.url.startsWith('/api/health')) {
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
                },
              }),
            )
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
  const devPassword = env.SEED_ADMIN_PASSWORD || 'sandesh@1409'
  const devLogins = devLogin
    ? ACCOUNTS.map((account) => ({ label: account.label, email: account.email }))
    : []

  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
    define: {
      __DEV_LOGIN_PASSWORD__: JSON.stringify(devLogin ? devPassword : ''),
      __DEV_LOGINS__: JSON.stringify(devLogins),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
