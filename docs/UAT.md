# Viv UAT script — Deos Heartbeat Lite

**App:** https://deos-heartbeat.vercel.app  
**Accounts:** admin (Viv) + viewer (`support@thrumble.co.uk`)  
**Goal:** Confirm report config + fleet health for go-live.

## Before you start

- [ ] Supabase Auth: enable TOTP MFA for the project (Authentication → Providers / MFA)
- [ ] Confirm admin password reset if needed (do not share Viv’s login with support)
- [ ] Optional: assign a few unassigned vans under **Reports** so daily/weekly config is non-empty

## 1. Login & roles

| Step | Expected |
| --- | --- |
| Log in as admin | Lands on Fleet (or app shell) |
| Enroll MFA (admin) if prompted | TOTP enroll + challenge succeeds |
| Log out; log in as viewer | Read-only access |
| As viewer, try changing a trust/van/recipient toggle | Mutation fails / controls disabled |

## 2. Reports

| Step | Expected |
| --- | --- |
| Create a trust | Appears in left list; audit entry created |
| Add van + recipient | Both show under trust |
| Toggle trust/van daily & weekly | Switches persist after refresh |
| Pause a van / deactivate trust / soft-remove recipient | Status updates; soft-delete only |
| **Unassigned vans:** Assign one to a trust | Van becomes Active under that trust |
| Dismiss a junk unassigned row | Leaves the unassigned list |

## 3. Audit

| Step | Expected |
| --- | --- |
| Open Audit after the Changes above | Insert/update rows for trusts / vans / recipients |

## 4. Fleet

| Step | Expected |
| --- | --- |
| Heatmap loads | Trust groups + colour cells (live Grafana) |
| Trust filter Combobox | Stats recount for filtered trusts |
| Collapse / expand a trust | Rows hide/show |
| Open a van detail sheet | Metrics (modality, worklist, sync queues, etc.) — counts only, no patient IDs |
| Leave tab open ~60s | Payload refreshes without full page reload |

## 5. Session

| Step | Expected |
| --- | --- |
| Stay signed in | Session valid within 12 hours |
| Simulate expiry: DevTools → Application → Local Storage → set `deos.session.startedAt` to >12h ago → reload | Forced re-login |

## 6. API smoke (engineering)

### Report email (primary)

```bash
# Dry-run all eligible trusts
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"report_type":"daily","dry_run":true}' \
  https://deos-heartbeat.vercel.app/api/reports/send | jq '{sent,failed,skipped}'
```

Or use **Reports → Send test report** while signed in as admin.

### Optional compat APIs

```bash
curl -sS -H "Authorization: Bearer $REPORT_CONFIG_KEY" \
  https://deos-heartbeat.vercel.app/api/report-config | jq '.trusts | length'
```

| Check | Expected |
| --- | --- |
| `GET /api/health` | `ok: true`, database + grafana reachable |
| `POST /api/reports/send` dry_run | `{ skipped/sent results }` without Resend call |
| Admin Send test report | Email arrives for trust with recipients |

## 7. Sign-off

| Item | OK? | Notes |
| --- | --- | --- |
| Grey / amber thresholds acceptable | | |
| Active van list matches operations (assign/dismiss done) | | |
| MFA on for admin | | |
| No patient-identifiable data seen in UI | | |
| Ready for production domain / token rotate | | |

**Signed:** _______________  **Date:** _______________
