import { auth } from "@clerk/nextjs/server";
import { encryptCredentials } from "@/lib/integrations/crypto";
import { getIntegration, upsertIntegration } from "@/lib/integrations/database";

export const runtime = "nodejs";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const integration = await getIntegration(orgId, "whatsapp");
  return Response.json({ integration: integration ? { status: integration.status, displayName: integration.display_name, phoneNumberId: integration.external_account_id, lastError: integration.last_error } : null });
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { accessToken?: string; phoneNumberId?: string; businessName?: string } | null;
  const accessToken = payload?.accessToken?.trim();
  const phoneNumberId = payload?.phoneNumberId?.trim();
  const businessName = payload?.businessName?.trim().slice(0, 100);
  if (!accessToken || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) return Response.json({ error: "Add a valid permanent access token and phone number ID." }, { status: 400 });
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v24.0";
  const test = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!test.ok) return Response.json({ error: "Meta could not verify that token and phone number ID." }, { status: 400 });
  const phone = await test.json() as { display_phone_number?: string; verified_name?: string };
  await upsertIntegration({
    orgId, provider: "whatsapp", userId, externalAccountId: phoneNumberId,
    displayName: phone.display_phone_number ?? phone.verified_name ?? "WhatsApp",
    encryptedCredentials: encryptCredentials({ accessToken }),
    config: { businessName: businessName || phone.verified_name || "Support", mode: "capture_only" },
  });
  return Response.json({ connected: true, displayName: phone.display_phone_number ?? phone.verified_name });
}
