import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ChatMessage } from "./types";

type Database = NeonQueryFunction<false, false>;

export type KnowledgeDocumentRow = {
  id: string;
  title: string;
  source_name: string;
  source_type: string;
  mime_type: string | null;
  byte_size: number | null;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  indexed_at: string | null;
};

let database: Database | null | undefined;

export function getAgentDatabase() {
  if (database !== undefined) return database;
  database = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  return database;
}

export function isPersistenceConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureConversation(input: {
  id: string;
  orgId: string;
  userId: string;
  title: string;
}) {
  const sql = getAgentDatabase();
  if (!sql) return;

  const existing = await sql`
    select organization_id
    from ziggo_conversations
    where id = ${input.id}::uuid
    limit 1
  ` as Array<{ organization_id: string }>;

  if (existing[0] && existing[0].organization_id !== input.orgId) {
    throw new Error("This conversation belongs to a different workspace.");
  }

  if (existing[0]) {
    await sql`
      update ziggo_conversations
      set updated_at = now()
      where id = ${input.id}::uuid and organization_id = ${input.orgId}
    `;
    return;
  }

  await sql`
    insert into ziggo_conversations (id, organization_id, created_by, title)
    values (${input.id}::uuid, ${input.orgId}, ${input.userId}, ${input.title.slice(0, 90)})
  `;
}

export async function saveMessage(input: {
  conversationId: string;
  orgId: string;
  role: "assistant" | "user";
  content: string;
  citations?: unknown;
}) {
  const sql = getAgentDatabase();
  if (!sql) return;
  await sql`
    insert into ziggo_messages (conversation_id, organization_id, role, content, citations)
    values (
      ${input.conversationId}::uuid,
      ${input.orgId},
      ${input.role},
      ${input.content},
      ${JSON.stringify(input.citations ?? [])}::jsonb
    )
  `;
}

export async function logAgentEvent(input: {
  id?: string;
  conversationId: string;
  orgId: string;
  userId: string;
  eventType: string;
  toolName?: string;
  status: string;
  input?: unknown;
  output?: unknown;
}) {
  const sql = getAgentDatabase();
  const id = input.id ?? crypto.randomUUID();
  if (!sql) return id;
  await sql`
    insert into ziggo_agent_events (
      id, conversation_id, organization_id, user_id, event_type, tool_name, status, input, output
    ) values (
      ${id}::uuid,
      ${input.conversationId}::uuid,
      ${input.orgId},
      ${input.userId},
      ${input.eventType},
      ${input.toolName ?? null},
      ${input.status},
      ${JSON.stringify(input.input ?? {})}::jsonb,
      ${JSON.stringify(input.output ?? {})}::jsonb
    )
  `;
  return id;
}

export async function listConversations(orgId: string) {
  const sql = getAgentDatabase();
  if (!sql) return [];
  const rows = await sql`
    select id, title, updated_at
    from ziggo_conversations
    where organization_id = ${orgId}
    order by updated_at desc
    limit 20
  `;
  return rows as Array<{ id: string; title: string; updated_at: string }>;
}

export async function loadConversation(orgId: string, conversationId: string) {
  const sql = getAgentDatabase();
  if (!sql) return [];
  const messages = await sql`
    select id, role, content, created_at
    from ziggo_messages
    where organization_id = ${orgId} and conversation_id = ${conversationId}::uuid
    order by created_at asc
    limit 100
  ` as Array<{ id: number; role: "assistant" | "user"; content: string; created_at: string }>;
  return messages.map((message): ChatMessage => ({
    id: String(message.id),
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));
}

export async function listAgentEvents(orgId: string, conversationId: string) {
  const sql = getAgentDatabase();
  if (!sql) return [];
  const rows = await sql`
    select id, event_type, tool_name, status, input, output, created_at
    from ziggo_agent_events
    where organization_id = ${orgId} and conversation_id = ${conversationId}::uuid
    order by created_at asc
    limit 100
  `;
  return rows as Array<{
    id: string;
    event_type: string;
    tool_name: string | null;
    status: string;
    input: { reason?: string };
    output: { resultCount?: number };
    created_at: string;
  }>;
}

export async function listKnowledgeDocuments(orgId: string) {
  const sql = getAgentDatabase();
  if (!sql) return [];
  const rows = await sql`
    select id, title, source_name, source_type, mime_type, byte_size,
      status, chunk_count, error_message, created_at, indexed_at
    from ziggo_knowledge_documents
    where organization_id = ${orgId}
    order by created_at desc
    limit 50
  `;
  return rows as KnowledgeDocumentRow[];
}

export async function findKnowledgeDocumentByChecksum(orgId: string, checksum: string) {
  const sql = getAgentDatabase();
  if (!sql) return null;
  const rows = await sql`
    select id, title, source_name, source_type, mime_type, byte_size,
      status, chunk_count, error_message, created_at, indexed_at
    from ziggo_knowledge_documents
    where organization_id = ${orgId} and checksum = ${checksum} and status <> 'failed'
    limit 1
  ` as KnowledgeDocumentRow[];
  return rows[0] ?? null;
}

export async function createKnowledgeDocument(input: {
  id: string;
  orgId: string;
  title: string;
  sourceName: string;
  sourceType: "paste" | "upload" | "google_drive" | "conversation" | "whatsapp";
  mimeType?: string;
  byteSize?: number;
  checksum: string;
}) {
  const sql = getAgentDatabase();
  if (!sql) throw new Error("Neon is required for the knowledge library.");
  const rows = await sql`
    insert into ziggo_knowledge_documents (
      id, organization_id, title, source_name, source_type, mime_type,
      byte_size, checksum, status, chunk_count
    ) values (
      ${input.id}::uuid,
      ${input.orgId},
      ${input.title},
      ${input.sourceName},
      ${input.sourceType},
      ${input.mimeType ?? null},
      ${input.byteSize ?? null},
      ${input.checksum},
      'processing',
      0
    )
    returning id, title, source_name, source_type, mime_type, byte_size,
      status, chunk_count, error_message, created_at, indexed_at
  `;
  return rows[0] as KnowledgeDocumentRow;
}

export async function markKnowledgeDocumentReady(input: { id: string; orgId: string; chunkCount: number }) {
  const sql = getAgentDatabase();
  if (!sql) throw new Error("Neon is required for the knowledge library.");
  const rows = await sql`
    update ziggo_knowledge_documents
    set status = 'ready', chunk_count = ${input.chunkCount}, indexed_at = now(), updated_at = now(), error_message = null
    where id = ${input.id}::uuid and organization_id = ${input.orgId}
    returning id, title, source_name, source_type, mime_type, byte_size,
      status, chunk_count, error_message, created_at, indexed_at
  `;
  return rows[0] as KnowledgeDocumentRow | undefined;
}

export async function markKnowledgeDocumentFailed(input: { id: string; orgId: string; error: string }) {
  const sql = getAgentDatabase();
  if (!sql) return;
  await sql`
    update ziggo_knowledge_documents
    set status = 'failed', error_message = ${input.error.slice(0, 500)}, updated_at = now()
    where id = ${input.id}::uuid and organization_id = ${input.orgId}
  `;
}

export async function getKnowledgeDocument(orgId: string, id: string) {
  const sql = getAgentDatabase();
  if (!sql) return null;
  const rows = await sql`
    select id, title, source_name, source_type, mime_type, byte_size,
      status, chunk_count, error_message, created_at, indexed_at
    from ziggo_knowledge_documents
    where id = ${id}::uuid and organization_id = ${orgId}
    limit 1
  ` as KnowledgeDocumentRow[];
  return rows[0] ?? null;
}

export async function deleteKnowledgeDocument(orgId: string, id: string) {
  const sql = getAgentDatabase();
  if (!sql) throw new Error("Neon is required for the knowledge library.");
  await sql`
    delete from ziggo_knowledge_documents
    where id = ${id}::uuid and organization_id = ${orgId}
  `;
}

export async function resolveApproval(input: {
  eventId: string;
  orgId: string;
  userId: string;
  decision: "approved" | "denied";
}) {
  const sql = getAgentDatabase();
  if (!sql) throw new Error("Neon is required for approvals.");

  if (input.decision === "approved") {
    const handoffs = await sql`
      with approved_event as (
        update ziggo_agent_events
        set status = 'approved', reviewed_by = ${input.userId}, reviewed_at = now()
        where id = ${input.eventId}::uuid
          and organization_id = ${input.orgId}
          and status = 'pending'
        returning conversation_id, input
      )
      insert into ziggo_handoffs (
        organization_id, conversation_id, created_by, reason, summary, status
      )
      select
        ${input.orgId},
        conversation_id,
        ${input.userId},
        coalesce(input->>'reason', 'Customer requested help'),
        coalesce(input->>'summary', 'Review the conversation and follow up with the customer.'),
        'open'
      from approved_event
      returning id
    `;
    if (handoffs.length === 0) throw new Error("This approval is no longer available.");
    return;
  }

  const denied = await sql`
    update ziggo_agent_events
    set status = 'denied', reviewed_by = ${input.userId}, reviewed_at = now()
    where id = ${input.eventId}::uuid
      and organization_id = ${input.orgId}
      and status = 'pending'
    returning id
  `;
  if (denied.length === 0) throw new Error("This approval is no longer available.");
}
