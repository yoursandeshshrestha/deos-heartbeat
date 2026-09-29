-- Last-known GPS per van instance (fleet map fallback)

create table public.van_locations (
  instance text primary key,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index van_locations_recorded_at_idx on public.van_locations (recorded_at desc);

alter table public.van_locations enable row level security;

create policy van_locations_select on public.van_locations
  for select to authenticated
  using (true);
