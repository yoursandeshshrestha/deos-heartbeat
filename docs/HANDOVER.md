# Handover — Deos Heartbeat Lite

## What shipped

- **App:** https://deos-heartbeat.vercel.app (Vercel `thrumble2/deos-heartbeat`, region `lhr1`)
- **Stack:** Vite + React SPA; `/api/*` Vercel serverless; Supabase Auth + Postgres + RLS
- **Fleet:** live Grafana PromQL → status heatmap (Red / Amber / Grey / Green)
- **Reports:** trusts, vans, recipients, toggles, soft-delete; unassigned assign/dismiss
- **Integrations:** `GET /api/report-config`, `POST /api/report-runs` (API key); `/api/health`; `/api/uptime`

## Accounts

| Role | Email | Notes |
| --- | --- | --- |
| Admin (Viv) | seed admin in `src/lib/accounts` | Enable TOTP in Supabase Auth before UAT |
| Viewer | `support@thrumble.co.uk` | Thrumble support — never share Viv’s login |

## Secrets (Vercel Production + Preview)

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `GRAFANA_BASE_URL` / `GRAFANA_PROMETHEUS_UID` / `GRAFANA_TOKEN`
- `REPORT_CONFIG_KEY`
- Optional: `UPTIME_WEBHOOK_URL` (needs Vercel Pro for 5‑min cron)

## Before production cutover

1. **Supabase `eu-west-2`** — current project is Tokyo; create London project and migrate  
2. **Rotate Grafana token** — replace shared `glsa_` with a dedicated Viewer service account; revoke the old one  
3. **Viv UAT** — [`docs/UAT.md`](./UAT.md) + van list [`docs/van-inventory.md`](./van-inventory.md)  
4. **n8n cutover** — [`docs/n8n-report-config.md`](./n8n-report-config.md) in parallel with old lists for one cycle  
5. **Domain** — e.g. `dashboard.ukdeos.com` (UKDEOS DNS)  
6. **Auth settings** — TOTP MFA on; session timebox 12h  

## Data / compliance

- Fleet shows **counts and infrastructure metrics only** (`patients_today` is a count, not demographics).  
- No GPS / patient-identifiable fields in UI or API payloads.  
- Soft deletes only (`removed` / `active = false`).  

## Ops

- Fleet cache ~30s server-side; UI polls every 60s while visible.  
- Hobby plan: Vercel Cron every 5 minutes is blocked — use Pro or an external uptime ping to `/api/uptime`.  
- Expected maintenance: **2–4 eng hours / month**.

## Explicitly out of scope

Map, 24h history, daily/weekly dashboard PDFs, Freshdesk, email tracking UI, Trust Portal, alerting/24×7 polling — see `docs/PHASES.md`.
