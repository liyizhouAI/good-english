import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Checks if the cloud tables exist.
// If not, returns the SQL to create them manually.
const sql = `
create table if not exists user_learning_data (
  user_id       uuid references auth.users primary key,
  words_data    text not null default '[]',
  patterns_data text not null default '[]',
  materials_data text not null default '[]',
  updated_at    timestamptz not null default now()
);

alter table user_learning_data enable row level security;

create policy "Users manage own learning data"
  on user_learning_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

create policy "Users manage own fetch jobs"
  on content_fetch_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
`.trim();

export async function GET() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        status: 'no_service_key',
        message: 'Server 侧没有配置 SUPABASE_SERVICE_ROLE_KEY，无法自动检查；但你可以直接复制下面 SQL 到 Supabase 执行。',
        sql,
        dashboard_url: 'https://supabase.com/dashboard/project/twjsspsplskqsgmnegrk/sql/new',
      },
      { status: 200 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  const [learningCheck, jobsCheck] = await Promise.all([
    supabase.from('user_learning_data').select('user_id').limit(1),
    supabase.from('content_fetch_jobs').select('id').limit(1),
  ]);

  if (!learningCheck.error && !jobsCheck.error) {
    return NextResponse.json({ status: 'ok', message: 'Tables already exist' });
  }

  return NextResponse.json({
    status: 'table_missing',
    message: 'Table not found. Run the SQL below in Supabase Dashboard → SQL Editor.',
    sql,
    dashboard_url: 'https://supabase.com/dashboard/project/twjsspsplskqsgmnegrk/sql/new',
  });
}
