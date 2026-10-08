import { auth } from "@clerk/nextjs/server";
import { listAgentEvents, listConversations, loadConversation } from "@/lib/agent/database";

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("id");
  if (conversationId) {
    const [messages, events] = await Promise.all([
      loadConversation(orgId, conversationId),
      listAgentEvents(orgId, conversationId),
    ]);
    return Response.json({ messages, events });
  }
  return Response.json({ conversations: await listConversations(orgId) });
}
