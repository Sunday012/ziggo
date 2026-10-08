import { auth } from "@clerk/nextjs/server";
import { ensureConversation, saveMessage } from "@/lib/agent/database";
import { runSupportAgent } from "@/lib/agent/runtime";
import type { AgentStreamEvent, ChatMessage } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatPayload = {
  organizationName?: string;
  conversationId?: string;
  messages?: ChatMessage[];
};

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4_000;

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    (message.role === "assistant" || message.role === "user") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });

  let payload: ChatPayload;
  try {
    payload = await request.json() as ChatPayload;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > MAX_MESSAGES || !payload.messages.every(isValidMessage)) {
    return Response.json({ error: "The conversation contains invalid messages." }, { status: 400 });
  }
  const messages = payload.messages;

  const conversationId = payload.conversationId && /^[0-9a-f-]{36}$/i.test(payload.conversationId)
    ? payload.conversationId
    : crypto.randomUUID();
  const organizationName = payload.organizationName?.trim().slice(0, 100) || "this business";
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return Response.json({ error: "A user message is required." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await ensureConversation({ id: conversationId, orgId, userId, title: latestUserMessage.content });
        await saveMessage({ conversationId, orgId, role: "user", content: latestUserMessage.content });
        emit({ type: "conversation", conversationId });
        await runSupportAgent({
          organizationName,
          orgId,
          userId,
          conversationId,
          messages,
          signal: request.signal,
          emit,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The agent could not complete this request.";
        console.error("Agent run failed", error);
        emit({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
