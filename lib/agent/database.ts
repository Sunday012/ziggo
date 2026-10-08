import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "./types";

let client: SupabaseClient | null | undefined;

export function getAgentDatabase() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  client = url && secretKey
    ? createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return client;
}

export function isPersistenceConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function ensureConversation(input: {
  id: string;
  orgId: string;
  userId: string;
  title: string;
}) {
  const database = getAgentDatabase();
  if (!database) return;
  const { data: existing, error: readError } = await database
    .from("ziggo_conversations")
    .select("organization_id")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(`Could not verify conversation: ${readError.message}`);
  if (existing && existing.organization_id !== input.orgId) throw new Error("This conversation belongs to a different workspace.");

  if (existing) {
    const { error } = await database
      .from("ziggo_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", input.orgId);
    if (error) throw new Error(`Could not update conversation: ${error.message}`);
    return;
  }

  const { error } = await database.from("ziggo_conversations").insert({
    id: input.id,
    organization_id: input.orgId,
    created_by: input.userId,
    title: input.title.slice(0, 90),
  });
  if (error) throw new Error(`Could not persist conversation: ${error.message}`);
}

export async function saveMessage(input: {
  conversationId: string;
  orgId: string;
  role: "assistant" | "user";
  content: string;
  citations?: unknown;
}) {
  const database = getAgentDatabase();
  if (!database) return;
  const { error } = await database.from("ziggo_messages").insert({
    conversation_id: input.conversationId,
    organization_id: input.orgId,
    role: input.role,
    content: input.content,
    citations: input.citations ?? [],
  });
  if (error) throw new Error(`Could not persist message: ${error.message}`);
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
  const database = getAgentDatabase();
  const id = input.id ?? crypto.randomUUID();
  if (!database) return id;
  const { error } = await database.from("ziggo_agent_events").insert({
    id,
    conversation_id: input.conversationId,
    organization_id: input.orgId,
    user_id: input.userId,
    event_type: input.eventType,
    tool_name: input.toolName ?? null,
    status: input.status,
    input: input.input ?? {},
    output: input.output ?? {},
  });
  if (error) throw new Error(`Could not persist agent event: ${error.message}`);
  return id;
}

export async function listConversations(orgId: string) {
  const database = getAgentDatabase();
  if (!database) return [];
  const { data, error } = await database
    .from("ziggo_conversations")
    .select("id,title,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadConversation(orgId: string, conversationId: string) {
  const database = getAgentDatabase();
  if (!database) return [];
  const { data, error } = await database
    .from("ziggo_messages")
    .select("id,role,content,created_at")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((message): ChatMessage => ({
    id: String(message.id),
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));
}

export async function listAgentEvents(orgId: string, conversationId: string) {
  const database = getAgentDatabase();
  if (!database) return [];
  const { data, error } = await database
    .from("ziggo_agent_events")
    .select("id,event_type,tool_name,status,input,output,created_at")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listKnowledgeDocuments(orgId: string) {
  const database = getAgentDatabase();
  if (!database) return [];
  const { data, error } = await database
    .from("ziggo_knowledge_documents")
    .select("id,title,source_name,status,chunk_count,created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveKnowledgeDocument(input: {
  id: string;
  orgId: string;
  title: string;
  sourceName: string;
  chunkCount: number;
}) {
  const database = getAgentDatabase();
  if (!database) return;
  const { error } = await database.from("ziggo_knowledge_documents").insert({
    id: input.id,
    organization_id: input.orgId,
    title: input.title,
    source_name: input.sourceName,
    status: "ready",
    chunk_count: input.chunkCount,
  });
  if (error) throw new Error(error.message);
}

export async function resolveApproval(input: {
  eventId: string;
  orgId: string;
  userId: string;
  decision: "approved" | "denied";
}) {
  const database = getAgentDatabase();
  if (!database) throw new Error("Supabase is required for approvals.");

  const { data: event, error: readError } = await database
    .from("ziggo_agent_events")
    .select("id,conversation_id,input,status")
    .eq("id", input.eventId)
    .eq("organization_id", input.orgId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError || !event) throw new Error("This approval is no longer available.");

  const { error: updateError } = await database
    .from("ziggo_agent_events")
    .update({ status: input.decision, reviewed_by: input.userId, reviewed_at: new Date().toISOString() })
    .eq("id", input.eventId)
    .eq("organization_id", input.orgId);
  if (updateError) throw new Error(updateError.message);

  if (input.decision === "approved") {
    const eventInput = event.input as { reason?: string; summary?: string };
    const { error: handoffError } = await database.from("ziggo_handoffs").insert({
      organization_id: input.orgId,
      conversation_id: event.conversation_id,
      created_by: input.userId,
      reason: eventInput.reason ?? "Customer requested help",
      summary: eventInput.summary ?? "Review the conversation and follow up with the customer.",
      status: "open",
    });
    if (handoffError) throw new Error(handoffError.message);
  }
}
