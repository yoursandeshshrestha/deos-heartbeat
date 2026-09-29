-- Stored copies of daily and weekly performance PDFs.
-- Written by the service role when a report is generated. Signed-in readers can list rows.
-- File bytes live in the private generated-reports bucket (service role only).

create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid not null references public.trusts (id) on delete cascade,
  report_type public.report_type not null,
  filename text not null,
  storage_path text not null unique,
  period_label text not null default '',
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

create index generated_reports_created_at_idx
  on public.generated_reports (created_at desc);

alter table public.generated_reports enable row level security;

create policy generated_reports_select on public.generated_reports
  for select to authenticated
  using (public.is_authenticated_reader());

revoke insert, update, delete on public.generated_reports from authenticated, anon;
grant select on public.generated_reports to authenticated;

insert into storage.buckets (id, name, public)
values ('generated-reports', 'generated-reports', false)
on conflict (id) do nothing;
