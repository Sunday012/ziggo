create unique index if not exists ziggo_knowledge_documents_org_external_idx
  on ziggo_knowledge_documents (organization_id, source_type, external_id)
  where external_id is not null;

create table if not exists ziggo_channel_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null check (provider in ('whatsapp')),
  external_thread_id text not null,
  display_name text,
  conversation_id uuid not null references ziggo_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_thread_id)
);

create index if not exists ziggo_channel_threads_conversation_idx
  on ziggo_channel_threads (organization_id, conversation_id);

create table if not exists ziggo_channel_messages (
  provider text not null check (provider in ('whatsapp')),
  external_message_id text not null,
  organization_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, external_message_id)
);

create unique index if not exists ziggo_knowledge_candidates_pending_conversation_idx
  on ziggo_knowledge_candidates (organization_id, conversation_id)
  where conversation_id is not null and status = 'pending';
