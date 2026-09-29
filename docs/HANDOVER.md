# Handover — Deos Heartbeat Lite

## What shipped

- **App:** https://dashboard.ukdeos.com (Vercel `thrumble2/deos-heartbeat`, region `lhr1`)
- **Stack:** Vite + React SPA; `/api/*` Vercel serverless; Supabase Auth + Postgres + RLS
- **Fleet:** live Grafana PromQL → status heatmap (Red / Amber / Grey / Green); fleet map with live/last-known GPS
- **Reports:** trusts, vans, recipients, toggles, soft-delete; unassigned assign/dismiss; **in-app daily/weekly email** via Resend
- **Integrations:** `GET|POST /api/reports/send` (cron or admin); optional `GET /api/report-config` / `POST /api/report-runs` (API key); `/api/health`; `/api/uptime`

## Accounts

| Role | Email | Notes |
| --- | --- | --- |
| Admin (Viv) | seed admin in `src/lib/accounts` | Enable TOTP in Supabase Auth before UAT |
| Viewer | `support@thrumble.ai` | Thrumble support — never share Viv’s login |

## Secrets (Vercel Production + Preview)

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `GRAFANA_BASE_URL` / `GRAFANA_PROMETHEUS_UID` / `GRAFANA_TOKEN`
- `RESEND_API_KEY` / `REPORT_FROM_EMAIL` / `REPORT_FROM_NAME`
- `CRON_SECRET` (report send + uptime)
- Optional: `REPORT_CONFIG_KEY` (compat debug APIs only)
- Optional: `UPTIME_WEBHOOK_URL` (needs Vercel Pro for 5‑min cron)
- Optional: `VITE_MAPBOX_TOKEN` (fleet map)

## Before production cutover

1. **Supabase `eu-west-2`** — current project is Tokyo; create London project and migrate  
2. **Rotate Grafana token** — replace shared `glsa_` with a dedicated Viewer service account; revoke the old one  
3. **Viv UAT** — [`docs/UAT.md`](./UAT.md) + van list [`docs/van-inventory.md`](./van-inventory.md)  
4. **Report email** — set Resend env + recipients; smoke via Reports → **Send test report** — [`docs/report-email.md`](./report-email.md)  
5. **Domain** — `dashboard.ukdeos.com` (UKDEOS DNS → Vercel)  
6. **Auth settings** — TOTP MFA on; session timebox 12h  

## Data / compliance

- Fleet shows **counts and infrastructure metrics only** (`patients_today` is a count, not demographics).  
- Report emails include the same counts only — no patient identifiers.  
- Soft deletes only (`removed` / `active = false`).  

## Ops

- Fleet cache ~30s server-side; UI polls every 60s while visible.  
- Daily/weekly report crons in `vercel.json` (~05:00 / 05:30 UTC). Hobby plan cron limits apply (same caveat as uptime).  
- Expected maintenance: **2–4 eng hours / month**.

## Explicitly out of scope

24h history, pixel-perfect n8n PDF clones, email open/click tracking UI, Freshdesk, Trust Portal, alerting/24×7 polling — see `docs/PHASES.md`.
