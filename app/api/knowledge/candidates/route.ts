import { auth } from "@clerk/nextjs/server";
import { getAgentDatabase } from "@/lib/agent/database";
import { ingestKnowledge } from "@/lib/agent/ingestion";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const sql = getAgentDatabase();
  if (!sql) return Response.json({ candidates: [] });
  const candidates = await sql`
    select id, conversation_id, source_type, title, content, status, created_at
    from ziggo_knowledge_candidates where organization_id = ${orgId} and status = 'pending'
    order by created_at desc limit 30
  `;
  return Response.json({ candidates });
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const sql = getAgentDatabase();
  if (!sql) return Response.json({ error: "Neon is required for the review queue." }, { status: 503 });
  const payload = await request.json().catch(() => null) as { action?: string; conversationId?: string; candidateId?: string } | null;

  if (payload?.action === "create" && payload.conversationId && uuid.test(payload.conversationId)) {
    const conversations = await sql`
      select c.title,
        coalesce((select provider from ziggo_channel_threads t where t.organization_id = c.organization_id and t.conversation_id = c.id limit 1), 'conversation') as source_type,
        (select string_agg(case when m.role = 'user' then 'Customer: ' else 'Support: ' end || m.content, E'\n\n' order by m.created_at)
          from ziggo_messages m where m.organization_id = c.organization_id and m.conversation_id = c.id) as content,
        (select jsonb_agg(m.id order by m.created_at) from ziggo_messages m where m.organization_id = c.organization_id and m.conversation_id = c.id) as message_ids
      from ziggo_conversations c where c.organization_id = ${orgId} and c.id = ${payload.conversationId}::uuid limit 1
    ` as Array<{ title: string; source_type: "conversation" | "whatsapp"; content: string | null; message_ids: unknown }>;
    const conversation = conversations[0];
    if (!conversation?.content || conversation.content.length < 40) return Response.json({ error: "This conversation does not contain enough content yet." }, { status: 400 });
    const rows = await sql`
      insert into ziggo_knowledge_candidates (organization_id, conversation_id, source_type, title, content, source_message_ids)
      values (${orgId}, ${payload.conversationId}::uuid, ${conversation.source_type}, ${conversation.title}, ${conversation.content}, ${JSON.stringify(conversation.message_ids ?? [])}::jsonb)
      on conflict (organization_id, conversation_id) where conversation_id is not null and status = 'pending'
      do update set title = excluded.title, content = excluded.content, source_message_ids = excluded.source_message_ids
      returning id, conversation_id, source_type, title, content, status, created_at
    `;
    return Response.json({ candidate: rows[0] }, { status: 201 });
  }

  if ((payload?.action === "approve" || payload?.action === "reject") && payload.candidateId && uuid.test(payload.candidateId)) {
    const rows = await sql`
      select id, title, content, source_type from ziggo_knowledge_candidates
      where id = ${payload.candidateId}::uuid and organization_id = ${orgId} and status = 'pending' limit 1
    ` as Array<{ id: string; title: string; content: string; source_type: "conversation" | "whatsapp" }>;
    const candidate = rows[0];
    if (!candidate) return Response.json({ error: "This review item is no longer available." }, { status: 404 });
    if (payload.action === "approve") {
      await ingestKnowledge({ orgId, title: candidate.title, sourceName: candidate.source_type === "whatsapp" ? "Approved WhatsApp conversation" : "Approved support conversation", sourceType: candidate.source_type, content: candidate.content, externalId: candidate.id });
    }
    await sql`
      update ziggo_knowledge_candidates set status = ${payload.action === "approve" ? "approved" : "rejected"}, reviewed_by = ${userId}, reviewed_at = now()
      where id = ${candidate.id}::uuid and organization_id = ${orgId}
    `;
    return Response.json({ status: payload.action === "approve" ? "approved" : "rejected" });
  }
  return Response.json({ error: "Invalid review action." }, { status: 400 });
}
