-- Heartbeat add-ons: owned daily history, location track, Freshdesk cache, report opens.
-- Aggregate figures only. No patient-identifiable data.

alter table public.van_locations
  add column if not exists accuracy_m double precision,
  add column if not exists status text;

create table public.van_location_points (
  id uuid primary key default gen_random_uuid(),
  instance text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  status text,
  recorded_at timestamptz not null default now()
);

create index van_location_points_instance_recorded_idx
  on public.van_location_points (instance, recorded_at desc);

create table public.van_daily_summaries (
  instance text not null,
  day date not null,
  trust_slug text,
  display_name text not null,
  patients integer,
  studies integer,
  worklist integer,
  sync_speed numeric,
  sync_failed integer,
  sync_complete integer,
  status text,
  observed_seconds integer not null default 0,
  offline_seconds integer not null default 0,
  degraded_seconds integer not null default 0,
  moved boolean not null default false,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  updated_at timestamptz not null default now(),
  primary key (instance, day)
);

create index van_daily_summaries_day_idx on public.van_daily_summaries (day desc);
create index van_daily_summaries_trust_day_idx on public.van_daily_summaries (trust_slug, day desc);

create table public.support_tickets (
  id bigint primary key,
  subject text not null,
  status text not null,
  priority text,
  requester text,
  source text,
  assignee text,
  trust_slug text,
  instance text,
  created_at timestamptz,
  updated_at timestamptz,
  url text,
  synced_at timestamptz not null default now()
);

create index support_tickets_status_idx on public.support_tickets (status, updated_at desc);
create index support_tickets_instance_idx on public.support_tickets (instance);

create table public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid not null references public.trusts (id) on delete cascade,
  recipient_id uuid references public.recipients (id) on delete set null,
  report_type public.report_type not null,
  batch_id uuid not null,
  email text not null,
  resend_id text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

create index report_deliveries_sent_at_idx on public.report_deliveries (sent_at desc);
create index report_deliveries_resend_id_idx on public.report_deliveries (resend_id);
create index report_deliveries_batch_idx on public.report_deliveries (batch_id);

alter table public.van_location_points enable row level security;
alter table public.van_daily_summaries enable row level security;
alter table public.support_tickets enable row level security;
alter table public.report_deliveries enable row level security;

create policy van_location_points_select on public.van_location_points
  for select to authenticated
  using (public.is_authenticated_reader());

create policy van_daily_summaries_select on public.van_daily_summaries
  for select to authenticated
  using (public.is_authenticated_reader());

create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (public.is_authenticated_reader());

create policy report_deliveries_select on public.report_deliveries
  for select to authenticated
  using (public.is_authenticated_reader());

revoke insert, update, delete on public.van_location_points from authenticated, anon;
revoke insert, update, delete on public.van_daily_summaries from authenticated, anon;
revoke insert, update, delete on public.support_tickets from authenticated, anon;
revoke insert, update, delete on public.report_deliveries from authenticated, anon;

grant select on public.van_location_points to authenticated;
grant select on public.van_daily_summaries to authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.report_deliveries to authenticated;
