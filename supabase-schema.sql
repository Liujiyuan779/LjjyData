create table if not exists public.app_data (
  user_key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "app_data allow all"
on public.app_data
for all
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

create policy "resources allow all"
on storage.objects
for all
using (bucket_id = 'resources')
with check (bucket_id = 'resources');
