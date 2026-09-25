# Report workflow ↔ Heartbeat config API

Cut over daily/weekly reporting (assumed n8n) to read van/recipient lists from Heartbeat instead of hard-coded sheets.

**Base URL:** `https://deos-heartbeat.vercel.app`  
**Auth:** `Authorization: Bearer $REPORT_CONFIG_KEY` or header `x-api-key: $REPORT_CONFIG_KEY`  
**Secret:** Vercel / n8n credential only — never in the browser.

## 1. Fetch config (parallel with old source for one cycle)

`GET /api/report-config`

Returns active trusts only. Each trust includes:

- `vans` with `status === active` (paused / unassigned / removed omitted)
- `recipients` with `active === true`
- trust + van `daily_enabled` / `weekly_enabled` flags

Example (n8n HTTP Request node):

- Method: GET  
- URL: `{{$env.HEARTBEAT_URL}}/api/report-config`  
- Header: `Authorization` = `Bearer {{$env.REPORT_CONFIG_KEY}}`

Suggested parallel run:

1. Keep existing hard-coded list node  
2. Add Heartbeat config node beside it  
3. Diff / log mismatches for one full daily + weekly cycle  
4. Switch send step to Heartbeat payload when lists match  

## 2. Record each trust run

`POST /api/report-runs`

```json
{
  "trust_id": "<uuid from report-config>",
  "report_type": "daily",
  "status": "success"
}
```

On failure:

```json
{
  "trust_id": "<uuid>",
  "report_type": "weekly",
  "status": "failure",
  "error": "short reason"
}
```

Optional `run_at` (ISO timestamp). Response `201` with `{ run: { id, ... } }`.

## 3. Fallback

Last successful config snapshot is stored in Supabase `settings.report_config_last_ok` when config is fetched successfully. Workflow-side: if Heartbeat is unreachable, keep the previous node’s cached JSON and alert Thrumble (webhook TBD).

## 4. Curl smoke

```bash
curl -sS -H "Authorization: Bearer $REPORT_CONFIG_KEY" \
  "$HEARTBEAT_URL/api/report-config" | jq '.trusts[] | {slug, vans: (.vans|length), recipients: (.recipients|length)}'

curl -sS -X POST -H "Authorization: Bearer $REPORT_CONFIG_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trust_id":"'"$TRUST_ID"'","report_type":"daily","status":"success"}' \
  "$HEARTBEAT_URL/api/report-runs"
```

## Notes

- Only **assigned + active** vans appear — use Reports → Unassigned → Assign first.  
- Do **not** change Wednesday Email Tracking Automation in this cutover.  
- Rate limits: config ~60 / 5 min, runs ~120 / 5 min per IP.
