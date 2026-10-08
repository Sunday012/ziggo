import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ChatMessage } from "./types";

type Database = NeonQueryFunction<false, false>;

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
    select id, title, source_name, status, chunk_count, created_at
    from ziggo_knowledge_documents
    where organization_id = ${orgId}
    order by created_at desc
    limit 50
  `;
  return rows as Array<{
    id: string;
    title: string;
    source_name: string;
    status: string;
    chunk_count: number;
    created_at: string;
  }>;
}

export async function saveKnowledgeDocument(input: {
  id: string;
  orgId: string;
  title: string;
  sourceName: string;
  chunkCount: number;
}) {
  const sql = getAgentDatabase();
  if (!sql) return;
  await sql`
    insert into ziggo_knowledge_documents (
      id, organization_id, title, source_name, status, chunk_count
    ) values (
      ${input.id}::uuid,
      ${input.orgId},
      ${input.title},
      ${input.sourceName},
      'ready',
      ${input.chunkCount}
    )
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
