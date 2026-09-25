-- Align fleet thresholds with Technical Scope defaults (was over-aggressive).
update public.settings
set value = jsonb_build_object(
  'speed_floor_mbps', 0.25,
  'failed_queue_amber', 3,
  'retry_queue_amber', 5,
  'progress_amber_pct', 40,
  'scrape_stale_minutes', 10,
  'poll_interval_seconds', 60
),
updated_at = now()
where key = 'fleet_thresholds';
