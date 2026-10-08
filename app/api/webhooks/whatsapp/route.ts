import { createHmac, timingSafeEqual } from "node:crypto";
import { ensureConversation, getAgentDatabase, saveMessage } from "@/lib/agent/database";
import { getIntegrationByExternalAccount } from "@/lib/integrations/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

type WhatsAppPayload = { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>; messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }> } }> }> };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw) as WhatsAppPayload;
  const sql = getAgentDatabase();
  if (!sql) return new Response("Database unavailable", { status: 503 });
  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) continue;
    const integration = await getIntegrationByExternalAccount("whatsapp", phoneNumberId);
    if (!integration) continue;
    for (const message of value?.messages ?? []) {
      const text = message.type === "text" ? message.text?.body?.trim() : "";
      if (!message.id || !message.from || !text) continue;
      const accepted = await sql`
        insert into ziggo_channel_messages (provider, external_message_id, organization_id)
        values ('whatsapp', ${message.id}, ${integration.organization_id}) on conflict do nothing returning external_message_id
      `;
      if (!accepted.length) continue;
      const displayName = value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ?? message.from;
      let threads = await sql`
        select conversation_id from ziggo_channel_threads
        where organization_id = ${integration.organization_id} and provider = 'whatsapp' and external_thread_id = ${message.from} limit 1
      ` as Array<{ conversation_id: string }>;
      if (!threads[0]) {
        const conversationId = crypto.randomUUID();
        await ensureConversation({ id: conversationId, orgId: integration.organization_id, userId: `whatsapp:${message.from}`, title: `WhatsApp · ${displayName}` });
        await sql`
          insert into ziggo_channel_threads (organization_id, provider, external_thread_id, display_name, conversation_id)
          values (${integration.organization_id}, 'whatsapp', ${message.from}, ${displayName}, ${conversationId}::uuid)
          on conflict (organization_id, provider, external_thread_id) do update set display_name = excluded.display_name, updated_at = now()
        `;
        threads = await sql`
          select conversation_id from ziggo_channel_threads
          where organization_id = ${integration.organization_id} and provider = 'whatsapp' and external_thread_id = ${message.from} limit 1
        ` as Array<{ conversation_id: string }>;
      }
      if (threads[0]) await saveMessage({ conversationId: threads[0].conversation_id, orgId: integration.organization_id, role: "user", content: text });
    }
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
