create extension if not exists pgcrypto;

create table if not exists ziggo_conversations (
  id uuid primary key,
  organization_id text not null,
  created_by text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ziggo_conversations_org_updated_idx
  on ziggo_conversations (organization_id, updated_at desc);

create table if not exists ziggo_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references ziggo_conversations(id) on delete cascade,
  organization_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ziggo_messages_conversation_idx
  on ziggo_messages (organization_id, conversation_id, created_at);

create table if not exists ziggo_knowledge_documents (
  id uuid primary key,
  organization_id text not null,
  title text not null,
  source_name text not null,
  status text not null check (status in ('processing', 'ready', 'failed')),
  chunk_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ziggo_knowledge_documents_org_idx
  on ziggo_knowledge_documents (organization_id, created_at desc);

create table if not exists ziggo_agent_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ziggo_conversations(id) on delete cascade,
  organization_id text not null,
  user_id text not null,
  event_type text not null,
  tool_name text,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ziggo_agent_events_conversation_idx
  on ziggo_agent_events (organization_id, conversation_id, created_at);

create table if not exists ziggo_handoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  conversation_id uuid not null references ziggo_conversations(id) on delete cascade,
  created_by text not null,
  reason text not null,
  summary text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ziggo_handoffs_org_status_idx
  on ziggo_handoffs (organization_id, status, created_at desc);
