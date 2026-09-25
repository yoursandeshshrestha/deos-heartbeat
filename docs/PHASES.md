# Deos Heartbeat Lite — phase tracker

Living checklist for the engineering build. Maps 1:1 to [Deos Heartbeat Lite Technical Scope INTERNAL v1.0](../Deos_Heartbeat_Lite_Technical_Scope_INTERNAL_v1_0.pdf) (counterpart to client SoW v2.0, 10 weeks from sign-off).

**Product:** Report distribution management + fleet health monitoring for one primary user (Viv Barrett).

**Stack (decided):** Vite + React + TypeScript SPA (keep this repo; not Next.js). Hosted on Vercel (`lhr1`). shadcn/ui + Tailwind. SWR (60s poll). Supabase Postgres + Auth (`eu-west-2`) with SQL migrations + supabase-js. Sentry + uptime check.

**API note:** Scope’s `/api/*` routes become Vercel serverless functions (or Supabase Edge Functions) beside the SPA so `GRAFANA_TOKEN` and `REPORT_CONFIG_KEY` never reach the browser. Same contracts: `/api/fleet`, `/api/report-config`, `/api/report-runs`, `/api/health`, `/api/config`.

**Current repo note (25 Sep 2026):** Linked to Supabase **ukdeos** (`oowdlikrwfoyltrpmvjj`). Migrations/functions empty. App shell still has leftover portal pages — Phase 0 resets that to Heartbeat.

**Status key:** Not started · In progress · Blocked · Done

---

## Deadlines (10-week window)

| Milestone | Weeks | Status |
| --- | --- | --- |
| Phase 0 — Discovery & foundation | 1–2 | In progress |
| Phase 1 — Schema & report config API | 3–4 | In progress |
| Phase 2 — Auth & report management UI | 5–6 | Done (MFA needs hosted TOTP enabled) |
| Phase 3 — Fleet API & live dashboard | 7–8 | Done (fixtures until token) |
| Phase 4 — QA & UAT | 9 | In progress |
| Phase 5 — Go live & handover | 10 | Not started |

Owners (from scope): **Guna** backend/integration · **Jo** client liaison & UAT · Frontend TBC · **Nic** commercial.

---

## Phase 0 — Discovery & foundation

**Weeks:** 1–2  
**Status:** In progress  
**Owners:** Guna, Jo (sessions + data)

### Engineering

- [x] Stack locked: Vite + React (not Next.js)
- [x] Strip leftover portal UI; Heartbeat shell (login + app layout)
- [x] Vercel scaffolding: `vercel.json` (`lhr1`), SPA rewrites, security headers, stub `/api/*` routes — **linked to `thrumble2/deos-heartbeat`**
- [ ] Supabase Pro in `eu-west-2` — **blocked:** linked `ukdeos` (`oowdlikrwfoyltrpmvjj`) is **Northeast Asia (Tokyo)**, not London. WALG on, PITR off, no backup timestamps yet (new project). Needs new project in `eu-west-2` (ideally Thrumble org) before go-live.
- [x] Env pattern: `.env.example` + server-only secrets (`GRAFANA_TOKEN`, `REPORT_CONFIG_KEY`, service role); Preview vs Production set in Vercel dashboard
- [ ] Local seed fixtures from real Grafana CSV exports
- [x] Confirm Grafana edition/version (`https://mis.ukdeos.com/mon`) — **Open Source 13.2.2**
- [ ] Confirm Prometheus labels and value semantics (see open questions)
- [ ] Build instance ↔ van mapping; `vans.modality_target` for modality probe
- [ ] Audit current daily/weekly report workflow (tool assumed n8n; where lists live)
- [ ] Two UI sessions with Viv; mockups signed off

### Week 1 open questions (must resolve)

| # | Question | Who |
| --- | --- | --- |
| 1 | Grafana edition; can UKDEOS create a Viewer service account? | Jo → Viv — **edition confirmed Open Source 13.2.2** via token; still rotate to dedicated Viewer SA before go-live |
| 2 | Semantics of `deos_sync_destination_status` and `deos_*` gauges (1 = OK?) | Guna |
| 3 | How `probe_success{job="modality"}` instances map to van instances | Guna |
| 4 | Which tool runs daily/weekly reports, and where lists live | Guna |
| 5 | Exact active van list (exclude `.dserver`, xray-mob?); TIC entry | Jo + Viv — **eng:** hubs (`.dserver`/`-dserver`/`.vserver`), `.router`/`.routerN`, and `xray-mob` excluded from fleet; ~50 instances remain as unassigned pending Viv’s active list |
| 6 | Grey “not scheduled” + amber thresholds OK with Viv | Jo (UI sessions) |
| 7 | Preferred login; any read-only users at launch? | Jo + Viv |
| 8 | Subdomain on `ukdeos.com` + who manages DNS | Jo + Viv |

---

## Phase 1 — Schema, migration & reporting workflow

**Weeks:** 3–4  
**Status:** In progress (schema started early during Phase 0)  
**Owner:** Guna

### Data model

- [x] `trusts` — id, name, slug, daily_enabled, weekly_enabled, active, created_at
- [x] `vans` — trust_id, instance (unique), display_name, modality_target, daily/weekly flags, speed_floor, status (`active` \| `paused` \| `unassigned` \| `removed`)
- [x] `recipients` — trust_id, name, email, active
- [x] `settings` — key/value jsonb (thresholds, poll interval)
- [x] `profiles` — user_id, role (`admin` \| `viewer`) — single admin for Viv; keep role for later
- [x] `report_runs` — trust_id, report_type, run_at, status, error
- [x] `audit_log` — insert-only; trigger on trusts / vans / recipients
- [x] Soft deletes only (`removed` / `active = false`) — enforced in UI later; schema supports it
- [x] RLS: admin write; viewer read-only

### Integrations

- [ ] Migrate existing trusts, vans, recipients into Postgres
- [x] `GET /api/report-config` — API key auth (`REPORT_CONFIG_KEY`); active trusts, vans + flags, recipients
- [x] `POST /api/report-runs` — same API key; per-trust run result
- [ ] Update reporting workflow to call config endpoint; run **in parallel** with old hard-coded config for one cycle
- [x] Persist last successful config snapshot in `settings.report_config_last_ok` (workflow-side unreachable fallback + Thrumble alert still TBD)
- [ ] Do **not** touch Wednesday Email Tracking Automation

---

## Phase 2 — Auth & report management UI

**Weeks:** 5–6  
**Status:** Done (enable TOTP in hosted Supabase Auth dashboard)  
**Owners:** Frontend (TBC), Guna

- [x] Supabase Auth — single admin for Viv (email + password + TOTP MFA enroll/challenge gate)
- [x] Session timeout 12 hours (client absolute window + local `auth.sessions.timebox`; set same in hosted Auth settings)
- [x] Report management UI: trusts, vans, toggles, recipients
- [x] Audit log view
- [x] Soft-delete / pause flows in UI (trust deactivate, van status, recipient active=false)
- [x] Auto-discovered unassigned vans surfaced to admin (list section; assign flow later with fleet poll)
- [x] Security headers (CSP, HSTS in `vercel.json`); rate limit `/api/report-config` + `/api/report-runs`
- [x] Named Thrumble support account (never share Viv’s login) — `support@thrumble.co.uk` viewer in seed

---

## Phase 3 — Fleet health API & live dashboard

**Weeks:** 7–8  
**Status:** Done (live Grafana when `GRAFANA_TOKEN` is set; fixtures until then)  
**Owners:** Guna, Frontend (TBC)

### `/api/fleet`

- [x] Fan out ~14 PromQL instant queries in parallel (5s timeout each)
- [x] Merge by instance; exclude `.dserver` / `-dserver` / `.vserver` hubs, `.router` / `.routerN`, and `xray-mob`
- [x] Server cache 30s; return `stale: true` + last good payload on Grafana failure
- [x] Auto-discovery: new Grafana instances → `unassigned` vans (auto-create trust by slug; nicer `display_name`; `modality_target=instance`)
- [x] `deriveStatus` pure function + unit tests (Red / Grey / Amber / Green)
- [x] Thresholds from `settings`; per-van `speed_floor` overrides
- [x] Do **not** store time series; current day only
- [x] Do **not** query GPS (`snmp_latitude` / `longitude` / `accuracy`) — future add-on

### Metrics (each poll)

| Field | PromQL |
| --- | --- |
| modality_up | `probe_success{job="modality"}` |
| sync_dest_up | `deos_sync_destination_status` |
| patients_today | `orthanc_number_of_patients_today` |
| studies_today | `orthanc_number_of_studies_today` |
| worklist_today | `deos_worklist_today_count` |
| sync_speed | rate avg of `deos_sync_transfer_speed_*` |
| sync_failed / active / complete / retry | `deos_sync_queue_*_count` |
| db_up / orthanc_up / version / scrape_up | status + `up` |

### UI

- [x] Heatmap; trust collapse; trust filter (stats recalculated client-side from same payload)
- [x] Van detail panel
- [x] SWR poll every 60s while tab visible (`refreshWhenHidden: false`)
- [x] “Data delayed” banner when stale

**Note:** Without `GRAFANA_TOKEN`, `/api/fleet` serves fixtures (and Vite dev middleware proxies `/api/fleet` locally).

---

## Phase 4 — Internal QA & UAT

**Week:** 9  
**Status:** In progress  
**Owners:** Jo (UAT), Guna

- [x] Unit tests: `deriveStatus`, metric merge by instance, report-config filtering
- [x] Integration-style tests: `/api/fleet` merge against empty + partial (timeout) recorded shapes
- [x] Manual QA checklist vs every client scope bullet (see below)
- [x] Deploy to Vercel (`thrumble2/deos-heartbeat` + GitHub connected for preview deploys) — live Grafana when `GRAFANA_TOKEN` set
- [x] `/api/health` — DB probe + Grafana reachability/token check when configured
- [x] Uptime check every 5 minutes → `/api/uptime` ready; **5‑min Vercel Cron needs Pro** (Hobby blocks it). Set `UPTIME_WEBHOOK_URL` when Pro is enabled, or use an external uptime ping.
- [ ] Viv UAT with test script

### Manual QA checklist

- [ ] Login as Viv (admin) and Thrumble support (viewer)
- [ ] Admin MFA enroll / challenge (TOTP enabled in Supabase Auth)
- [ ] Viewer cannot mutate trusts/vans/recipients
- [ ] Reports: create trust, van, recipient; toggle daily/weekly; pause / soft-remove
- [ ] Audit log shows insert/update entries after Changes
- [x] Fleet heatmap loads (live Grafana; routers/hubs filtered)
- [ ] Trust filter + collapse; van detail sheet metrics
- [ ] Stale banner path (optional: break Grafana token briefly)
- [ ] `GET /api/report-config` with `REPORT_CONFIG_KEY` returns active vans only
- [ ] `POST /api/report-runs` records success/failure
- [x] `GET /api/health` returns `ok: true` with DB reachable
- [ ] Session ends after 12 hours (or simulate by backdating `deos.session.startedAt`)
- [ ] No patient-identifiable fields in UI or API payloads

---

## Phase 5 — Production go-live & handover

**Week:** 10  
**Status:** Not started  
**Owners:** Guna, Jo

- [ ] Fix UAT issues
- [ ] Rotate to dedicated Grafana Viewer service account token; revoke old `glsa_` shared in chat
- [ ] Production deploy (production Supabase + live Grafana)
- [ ] Domain e.g. `dashboard.ukdeos.com` (DNS by UKDEOS)
- [ ] Walkthrough with Viv
- [ ] Handover notes (incl. no patient-identifiable data statement for NHS trusts)
- [ ] Confirm maintenance budget: 2–4 eng hours / month

---

## Explicitly out of this build

Do not build without a signed change request:

- Live Satellite Fleet Map + 24h van history
- Daily & Weekly Dashboards (+ Trust PDF export)
- Freshdesk tickets
- Email Tracking in Heartbeat
- Trust Portal (discovery first only)
- Alerting / 24/7 background polling / Jo voice agent
- Historical storage & AI / anomaly detection
- Grafana-side changes
- Report template changes; Wednesday Email Tracking Automation
- Multi-user roles beyond single admin (+ optional viewer account)

Design query layer + schema so these can plug in later.

---

## Optional add-ons (only if ordered)

| Add-on | Rough estimate |
| --- | --- |
| Fleet map | 4–5 days |
| Map + 24h history | 7–9 days |
| Daily & Weekly Dashboards | ~8.5 days |
| Freshdesk (needs dashboards) | 5.5–6.5 days |
| Email Tracking | 3–4 days |
| Trust Portal (post-discovery) | 11–14 days build (excl. compliance) |

Complete Visibility bundle = map + history + daily/weekly. Confirmed add-ons by end of discovery may run alongside core; bundle can add up to ~2 weeks.

---

## Progress log

| Date | Phase | Note |
| --- | --- | --- |
| 25 Sep 2026 | 0 | Tracker created from Technical Scope v1.0. Supabase CLI linked to **ukdeos** (`oowdlikrwfoyltrpmvjj`). Migrations empty; app still has leftover portal UI. |
| 25 Sep 2026 | 0 | Stack decision: stay on Vite + React. Scope Next.js APIs → Vercel serverless (or Edge Functions) with the same `/api/*` contracts. |
| 25 Sep 2026 | 0 | Portal UI stripped. Shell: login + Fleet / Reports / Audit placeholders. Roles simplified to admin \| viewer. |
| 25 Sep 2026 | 0 | Vercel + API scaffold: `vercel.json` (lhr1, SPA fallback, CSP/HSTS), stubs for fleet/report-config/report-runs/health/config, `.env.example`. Project link blocked until `vercel login`. |
| 25 Sep 2026 | 0 | Supabase check: `ukdeos` is Tokyo (not eu-west-2). WALG true / PITR false / no backup window yet. Region fix required before production. Starting Phase 1 schema on current project for local progress. |
| 25 Sep 2026 | 1 | Core schema migration applied (`trusts`, `vans`, `recipients`, `settings`, `profiles`, `report_runs`, `audit_log` + RLS + audit triggers). Seed accounts ready. |
| 25 Sep 2026 | 0 | Removed Drizzle; schema stays on Supabase migrations + supabase-js. |
| 25 Sep 2026 | 1 | Implemented `GET /api/report-config` + `POST /api/report-runs` (API key). Snapshot stored in settings. Demo trust fixture in seed. |
| 25 Sep 2026 | 2 | Reports UI (trusts/vans/recipients, toggles, soft-delete/pause) + Audit log page. Admin write / viewer read via RLS. |
| 25 Sep 2026 | 2 | 12h session timeout, TOTP MFA enroll/challenge gate (admin), rate limits on report APIs. Enable TOTP in hosted Supabase Auth. |
| 25 Sep 2026 | 3 | Fleet: `deriveStatus` + tests, `/api/fleet` (Grafana/fixtures, 30s cache, auto-discover), heatmap UI with SWR 60s + stale banner. Local Vite `/api/fleet` middleware. |
| 25 Sep 2026 | 4 | More tests (merge, report-config filter, empty/partial Grafana). `/api/health` probes DB + Grafana when token set. |
| 25 Sep 2026 | 0 | Vercel linked `thrumble2/deos-heartbeat`; Preview+Production env set (no GRAFANA_TOKEN yet). First deploy live. |
| 25 Sep 2026 | 4 | GitHub repo connected to Vercel. Manual QA checklist added. `/api/uptime` cron every 5m (webhook optional). |
| 25 Sep 2026 | 3 | Fleet cleanup: exclude routers/xray-mob from merge+discovery; ensure trusts on discover; display_name from instance. Live probe ~50 screening vans. Deployed to production. |
