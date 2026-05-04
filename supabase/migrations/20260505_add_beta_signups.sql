create table if not exists beta_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

alter table beta_signups enable row level security;

-- Anyone can insert their email (no auth required)
create policy "Public can insert beta signups"
  on beta_signups for insert
  to anon
  with check (true);
