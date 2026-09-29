# In-app trust report email

Heartbeat sends **one HTML + text email per trust** via [Resend](https://resend.com), using live fleet metrics. No external n8n workflow is required for delivery.

**Endpoint:** `GET|POST /api/reports/send`  
**Auth:** `Authorization: Bearer $CRON_SECRET` (Vercel Cron) **or** admin Supabase access token  
**Env (Vercel + local):** `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `REPORT_FROM_NAME`, `CRON_SECRET`

## Eligibility

For each trust, a report is sent only when all of:

- trust `active` and the trust-level `daily_enabled` / `weekly_enabled` flag matches `report_type`
- ≥1 active recipient
- ≥1 van with `status === active` and the matching van-level flag

Content: one performance PDF per trust (a page per included van), plus a short email summary. Counts only — no patient identifiers.

Daily PDF (London today): studies transferred, average transfer speed, and the start/end time the modality was connected.

Weekly PDF (the previous seven London days, Monday–Sunday when the Monday cron runs): the same figures per day, plus a week total.

Admins choose which of those figures appear under **Reports → PDF contents**. The choice is stored in `settings.report_pdf` and applies to every trust. At least one figure stays on.

## Schedules (Vercel Cron)

Defined in `vercel.json` (UTC; ~06:00 Europe/London in BST):

| Report  | Path                                         | Cron            |
|---------|----------------------------------------------|-----------------|
| Daily   | `/api/reports/send?report_type=daily`        | `0 5 * * *`     |
| Weekly  | `/api/reports/send?report_type=weekly`       | `30 5 * * 1`    |

**Hobby plan:** Vercel allows a limited number of cron jobs; same caveat as uptime. Set `CRON_SECRET` in the project so Cron requests are authenticated.

## Admin test send

On **Reports** → select a trust → **Send test report** (admin). Calls:

```http
POST /api/reports/send
Authorization: Bearer <supabase access_token>
Content-Type: application/json

{ "report_type": "daily", "trust_id": "<uuid>" }
```

Successful sends insert `report_runs` rows (`success` / `failure`).

Each generated PDF is also stored in the private `generated-reports` bucket and listed on **Report history** (`/report-history`), newest first, 10 per page. Dry runs are not stored. If storage fails, the email still sends and the result includes `copy not stored`. Signed-in readers open a PDF via `GET /api/generated-reports?id=<uuid>`.

## Dry run

```bash
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"report_type":"daily","dry_run":true}' \
  "$HEARTBEAT_URL/api/reports/send" | jq .
```

## Optional compat APIs

`GET /api/report-config` and `POST /api/report-runs` (API key `REPORT_CONFIG_KEY`) remain for debug/compat. They are **not** required for email delivery.

## Ops checklist

1. Set `RESEND_API_KEY` on Vercel (prefer a dedicated UKDEOS key; local/dev may reuse Thrumble temporarily).
2. Verify `REPORT_FROM_EMAIL` domain in the Resend dashboard (e.g. `reports@mail.thrumble.ai` until UKDEOS mail is verified).
3. Set `CRON_SECRET` and confirm cron hits return `200` with `{ sent, failed, skipped }`.
4. Add recipients per trust in the Reports UI before expecting production mail.
