#!/usr/bin/env node
/**
 * One-time script to create the Good English cloud tables in Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/setup-sync-table.mjs
 *
 * Get your service role key:
 *   Supabase Dashboard → Settings → API → Project API keys → service_role
 */

const SUPABASE_URL = 'https://twjsspsplskqsgmnegrk.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY env var');
  console.error('   Run: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/setup-sync-table.mjs');
  console.error('   Get key: Supabase Dashboard → Settings → API → service_role');
  process.exit(1);
}

const SQL = `
create table if not exists user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  settings_data text not null,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table user_settings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_settings'
    and policyname = 'Users manage own settings'
  ) then
    create policy "Users manage own settings"
      on user_settings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists user_learning_data (
  user_id uuid references auth.users primary key,
  words_data    text not null default '[]',
  patterns_data text not null default '[]',
  materials_data text not null default '[]',
  updated_at    timestamptz not null default now()
);

alter table user_learning_data enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_learning_data'
    and policyname = 'Users manage own learning data'
  ) then
    create policy "Users manage own learning data"
      on user_learning_data for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists content_fetch_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_url text not null,
  status text not null default 'pending',
  error text,
  result_summary jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_content_fetch_jobs_status_requested_at
  on content_fetch_jobs(status, requested_at);

alter table content_fetch_jobs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_fetch_jobs'
    and policyname = 'Users manage own fetch jobs'
  ) then
    create policy "Users manage own fetch jobs"
      on content_fetch_jobs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
`.trim();

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
  },
  body: JSON.stringify({ sql: SQL }),
});

if (!res.ok) {
  // Try alternative: use pg connection via Supabase Management API
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/twjsspsplskqsgmnegrk/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: SQL }),
    }
  );

  if (!mgmtRes.ok) {
    const body = await mgmtRes.text();
    console.error('❌ Failed:', mgmtRes.status, body.slice(0, 300));
    console.error('\nAlternative: Run this SQL manually in Supabase Dashboard → SQL Editor:\n');
    console.log(SQL);
    process.exit(1);
  }

  console.log('✅ Table created via Management API');
} else {
  console.log('✅ Table created via REST API');
}
