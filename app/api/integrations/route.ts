import { auth } from "@clerk/nextjs/server";
import { disconnectIntegration, listIntegrations, type IntegrationProvider } from "@/lib/integrations/database";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  return Response.json({ integrations: await listIntegrations(orgId) });
}

export async function DELETE(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const provider = new URL(request.url).searchParams.get("provider") as IntegrationProvider | null;
  if (provider !== "google_drive" && provider !== "whatsapp") return Response.json({ error: "Unknown integration." }, { status: 400 });
  await disconnectIntegration(orgId, provider);
  return Response.json({ disconnected: true });
}
