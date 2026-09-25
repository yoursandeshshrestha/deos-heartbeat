# Deos Heartbeat Lite

Vite + React SPA for UKDEOS fleet health and report distribution. Server secrets stay in Vercel serverless `/api/*` (region `lhr1`).

## Local

```bash
cp .env.example .env   # fill Supabase + optional seed password
bun install
bun run seed           # needs SUPABASE_SERVICE_ROLE_KEY
bun run dev            # SPA only (http://localhost:5173)
```

API routes (`/api/fleet`, `/api/report-config`, …) need the Vercel runtime:

```bash
vercel login
vercel link            # create/link project; set function region lhr1
bun run dev:full       # SPA + /api via `vercel dev`
```

## Env

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_*` | Browser | Public URL + publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / seed | Never `VITE_` |
| `GRAFANA_TOKEN` | Server | Viewer SA; never browser |
| `REPORT_CONFIG_KEY` | Server | Report workflow auth |
| `SEED_ADMIN_PASSWORD` | Local only | Optional; seed/login shortcuts |

Set separate Preview vs Production values in the Vercel dashboard for secrets.

## Phase tracker

See [docs/PHASES.md](docs/PHASES.md).
