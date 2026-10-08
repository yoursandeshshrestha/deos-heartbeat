# Heartbeat add-ons

Live fleet health stays on Grafana. These add-ons keep a copy UKDEOS owns.

## What is included

- Satellite fleet map with status and trust filters, clustered markers, accuracy rings, and a GPS health list. Vans with no fix are listed and not plotted.
- Daily history for the fleet, each trust, and each van. Day is compared with the same weekday last week. Week is compared with the previous week. Longer ranges cover 3, 6, and 12 months, or all stored history.
- Each fresh Grafana poll updates that van's day and appends a location point when the van moves, changes status, or has been still for 20 minutes. Small jumps inside the reported accuracy are dropped.
- Freshdesk tickets, view only. Set `FRESHDESK_DOMAIN` and `FRESHDESK_API_KEY`. The tickets page refreshes them every 15 minutes. Reply in Freshdesk.
- Report engagement. Each recipient gets their own email so an open can be tied to them. Point a Resend webhook at `/functions/v1/api/webhooks/resend` and set `RESEND_WEBHOOK_SECRET`. Opens are detected opens, not an exact count. The Wednesday tracking report is unchanged.
- History export from Insights downloads the stored daily rows as CSV.

## What is not included

The Trust Portal is not built. Giving NHS trusts a login needs a discovery phase with those trusts first.

## Backfill

Grafana still deletes raw history after about 120 days. To copy what it still holds:

```bash
bun run history:import -- --days 120
```

After that, Heartbeat keeps each new day itself. Apply `supabase/migrations/20261006120000_heartbeat_addons.sql` before the first poll or the import.
