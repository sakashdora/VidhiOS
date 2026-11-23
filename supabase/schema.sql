-- VidhiOS Scalable PostgreSQL Schema (Supabase-Ready with Row Level Security)
-- Apply in Supabase SQL Editor when migrating from local server persistence to Supabase Postgres.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'advocate',
  organization text default '',
  default_jurisdiction text not null default 'india_litigation',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  matter_code text not null,
  client_name text not null,
  jurisdiction text not null check (jurisdiction in ('india_litigation', 'corporate_ma', 'global_multi')),
  forum text not null,
  status text not null default 'active' check (status in ('active', 'pending_hearing', 'in_review', 'closed')),
  summary_facts text not null default '',
  opposing_party text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matters_user_id on public.matters(user_id);

create table if not exists public.research_memos (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  query text not null,
  jurisdiction text not null,
  answer_markdown text not null,
  citations jsonb not null default '[]'::jsonb,
  citation_integrity jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  doc_type text not null,
  content text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  doc_category text not null default 'Annexure',
  extracted_text text not null default '',
  translated_text text not null default '',
  target_language text default '',
  chronology jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_reviews (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  playbook text not null,
  source_text text not null,
  summary text not null default '',
  clauses jsonb not null default '[]'::jsonb,
  requisitions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.courtroom_sessions (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('bench', 'opposing_counsel')),
  forum_context text not null,
  brief_excerpt text not null,
  turns jsonb not null default '[]'::jsonb,
  vulnerabilities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracked_cases (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_number text not null,
  cnr_number text not null default '',
  court text not null,
  courtroom text not null default '',
  bench text not null default '',
  cause_list_item text not null default '',
  next_hearing_date date not null,
  stage text not null,
  status text not null default 'listed' check (status in ('listed', 'in_session', 'adjourned', 'disposed')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  statute_article text not null,
  trigger_date date not null,
  due_date date not null,
  grace_date date,
  completed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_briefs (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  duration_label text not null default '00:00',
  transcript text not null,
  summary text not null,
  key_facts jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  statutory_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references public.matters(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  body text not null,
  command_tag text default '',
  created_at timestamptz not null default now()
);

-- Enable Row Level Security across all tenant-scoped tables
alter table public.matters enable row level security;
alter table public.research_memos enable row level security;
alter table public.drafts enable row level security;
alter table public.vault_documents enable row level security;
alter table public.contract_reviews enable row level security;
alter table public.courtroom_sessions enable row level security;
alter table public.tracked_cases enable row level security;
alter table public.deadlines enable row level security;
alter table public.meeting_briefs enable row level security;
alter table public.whatsapp_messages enable row level security;

-- Owner-scoped RLS policies
create policy "Users manage own matters" on public.matters for all using (auth.uid() = user_id);
create policy "Users manage own memos" on public.research_memos for all using (auth.uid() = user_id);
create policy "Users manage own drafts" on public.drafts for all using (auth.uid() = user_id);
create policy "Users manage own vault" on public.vault_documents for all using (auth.uid() = user_id);
create policy "Users manage own reviews" on public.contract_reviews for all using (auth.uid() = user_id);
create policy "Users manage own sessions" on public.courtroom_sessions for all using (auth.uid() = user_id);
create policy "Users manage own cases" on public.tracked_cases for all using (auth.uid() = user_id);
create policy "Users manage own deadlines" on public.deadlines for all using (auth.uid() = user_id);
create policy "Users manage own meetings" on public.meeting_briefs for all using (auth.uid() = user_id);
create policy "Users manage own whatsapp" on public.whatsapp_messages for all using (auth.uid() = user_id);
