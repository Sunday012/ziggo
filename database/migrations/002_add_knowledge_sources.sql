alter table ziggo_knowledge_documents
  add column if not exists source_type text not null default 'paste',
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists checksum text,
  add column if not exists external_id text,
  add column if not exists error_message text,
  add column if not exists indexed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ziggo_knowledge_documents_org_checksum_idx
  on ziggo_knowledge_documents (organization_id, checksum)
  where checksum is not null and status <> 'failed';

create table if not exists ziggo_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null check (provider in ('google_drive', 'whatsapp')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  display_name text,
  external_account_id text,
  encrypted_credentials text,
  config jsonb not null default '{}'::jsonb,
  sync_cursor text,
  last_synced_at timestamptz,
  last_error text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists ziggo_integrations_org_idx
  on ziggo_integrations (organization_id, provider);

create table if not exists ziggo_knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  conversation_id uuid references ziggo_conversations(id) on delete set null,
  source_type text not null check (source_type in ('conversation', 'whatsapp')),
  title text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source_message_ids jsonb not null default '[]'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ziggo_knowledge_candidates_review_idx
  on ziggo_knowledge_candidates (organization_id, status, created_at desc);
