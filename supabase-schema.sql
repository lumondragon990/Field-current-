-- ============================================================
-- FieldCurrent — Supabase schema
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- CUSTOMERS ---------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  access_code text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- JOBS --------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  title text not null,
  site text,
  scope text,
  status text not null default 'scheduled', -- scheduled | in_progress | on_hold | complete
  job_number text,
  created_at timestamptz not null default now()
);

-- UPDATES (photos, reports, notes) ---------------------------
create table if not exists updates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null default 'note', -- note | photos | report | status
  title text,
  body text,
  photo_urls jsonb not null default '[]'::jsonb,
  author text default 'Tradelec Field Team',
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_customer on jobs(customer_id);
create index if not exists idx_updates_job on updates(job_id, created_at desc);

-- REALTIME: push new updates to customer screens instantly ----
alter publication supabase_realtime add table updates;
alter publication supabase_realtime add table jobs;

-- RLS (v1: open policies — the app gates access by admin PIN +
-- per-customer access codes; tighten later with Supabase Auth) -
alter table customers enable row level security;
alter table jobs enable row level security;
alter table updates enable row level security;

create policy "anon read customers"  on customers for select using (true);
create policy "anon write customers" on customers for insert with check (true);
create policy "anon edit customers"  on customers for update using (true);
create policy "anon del customers"   on customers for delete using (true);

create policy "anon read jobs"  on jobs for select using (true);
create policy "anon write jobs" on jobs for insert with check (true);
create policy "anon edit jobs"  on jobs for update using (true);
create policy "anon del jobs"   on jobs for delete using (true);

create policy "anon read updates"  on updates for select using (true);
create policy "anon write updates" on updates for insert with check (true);
create policy "anon edit updates"  on updates for update using (true);
create policy "anon del updates"   on updates for delete using (true);

-- STORAGE bucket for job photos -------------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

create policy "public read photos" on storage.objects
  for select using (bucket_id = 'job-photos');
create policy "anon upload photos" on storage.objects
  for insert with check (bucket_id = 'job-photos');
