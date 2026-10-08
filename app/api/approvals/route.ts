import { auth } from "@clerk/nextjs/server";
import { resolveApproval } from "@/lib/agent/database";

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { eventId?: string; decision?: string } | null;
  if (!payload?.eventId || (payload.decision !== "approved" && payload.decision !== "denied")) {
    return Response.json({ error: "A valid approval decision is required." }, { status: 400 });
  }
  try {
    await resolveApproval({ eventId: payload.eventId, orgId, userId, decision: payload.decision });
    return Response.json({ ok: true, status: payload.decision });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status: 409 });
  }
}
