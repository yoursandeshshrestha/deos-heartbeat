# In-app trust report email

Heartbeat sends **one HTML + text email per trust** via [Resend](https://resend.com), using live fleet metrics. No external n8n workflow is required for delivery.

**Endpoint:** `GET|POST /functions/v1/api/reports/send` on the Supabase project  
**Auth:** `x-cron-secret: $CRON_SECRET` (pg_cron) **or** admin Supabase access token. `Authorization: Bearer $CRON_SECRET` still works for manual calls.  
**Secrets (Supabase Edge Functions, not Vercel):** `RESEND_API_KEY`, `GRAFANA_TOKEN`, `CRON_SECRET`, `REPORT_CONFIG_KEY`, `SLACK_REPORT_WEBHOOK_URL`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function. `REPORT_FROM_EMAIL` defaults to `no-reply@mail.thrumble.ai`.

## Eligibility

For each trust, a report is sent only when all of:

- trust `active` and the trust-level `daily_enabled` / `weekly_enabled` flag matches `report_type`
- ≥1 active recipient
- ≥1 van with `status === active` and the matching van-level flag

Content: one performance PDF per trust (a page per included van), plus a short email summary. Counts only — no patient identifiers.

Daily PDF (the previous London day, so a 30 Sep send covers 29 Sep): studies transferred, average transfer speed, and the start/end time the modality was connected. Modality times use a sample every 60 seconds, shown in both 24-hour and 12-hour form (`06:58 (6:58 AM)`).

Weekly PDF (the previous seven London days, Monday–Sunday when the Monday cron runs): the same figures per day, plus a week total.

Admins choose which of those figures appear under **Reports → PDF contents**. The choice is stored in `settings.report_pdf` and applies to every trust. At least one figure stays on.

## Schedules (Supabase pg_cron)

| Report  | Path                                                         | Cron            |
|---------|--------------------------------------------------------------|-----------------|
| Daily   | `/functions/v1/api/reports/send?report_type=daily`           | `0 5 * * *`     |
| Weekly  | `/functions/v1/api/reports/send?report_type=weekly`          | `30 5 * * 1`    |

## Admin test send

On **Reports** → select a trust → **Send test report** (admin). Calls:

```http
POST /api/reports/send
Authorization: Bearer <supabase access_token>
Content-Type: application/json

{ "report_type": "daily", "trust_id": "<uuid>" }
```

Successful sends insert `report_runs` rows (`success` / `failure`).

After the run, one Slack message lists every trust whose email went out: recipient addresses and the PDF filename. Skipped and failed trusts are left out. Dry runs do not post. Set `SLACK_REPORT_WEBHOOK_URL` on the Edge Function; if it is missing, or Slack rejects the post, the emails still send.

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

1. Set `RESEND_API_KEY`, `GRAFANA_TOKEN`, `CRON_SECRET`, and `SLACK_REPORT_WEBHOOK_URL` with `supabase secrets set` (not on Vercel).
2. Verify the from-domain `no-reply@mail.thrumble.ai` in the Resend dashboard.
3. Confirm the daily cron returns `{ sent, failed, skipped }`.
4. Add recipients per trust in the Reports UI before expecting production mail.
