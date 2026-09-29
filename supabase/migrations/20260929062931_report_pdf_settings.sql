-- Which figures appear in daily/weekly performance PDFs (all trusts).

insert into public.settings (key, value)
values (
  'report_pdf',
  jsonb_build_object(
    'studies', true,
    'transfer_speed', true,
    'modality_window', true,
    'week_total', true
  )
)
on conflict (key) do nothing;
