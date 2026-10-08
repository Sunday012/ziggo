import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { encryptCredentials } from "@/lib/integrations/crypto";
import { exchangeGoogleCode } from "@/lib/integrations/google-drive";
import { upsertIntegration } from "@/lib/integrations/database";

export const runtime = "nodejs";

function destination(request: Request, value: string) {
  return new URL(`/assistant?drive=${value}`, request.url);
}

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.redirect(destination(request, "auth-required"));
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get("ziggo_google_oauth")?.value;
  cookieStore.delete("ziggo_google_oauth");
  if (!code || !state || expected !== `${state}.${orgId}`) return Response.redirect(destination(request, "invalid-state"));
  try {
    const credentials = await exchangeGoogleCode(code);
    const profileResponse = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)", { headers: { Authorization: `Bearer ${credentials.accessToken}` } });
    const profile = profileResponse.ok ? await profileResponse.json() as { user?: { displayName?: string; emailAddress?: string; permissionId?: string } } : {};
    await upsertIntegration({
      orgId, provider: "google_drive", userId,
      displayName: profile.user?.emailAddress ?? profile.user?.displayName ?? "Google Drive",
      externalAccountId: profile.user?.permissionId,
      encryptedCredentials: encryptCredentials(credentials),
    });
    return Response.redirect(destination(request, "connected"));
  } catch (error) {
    console.error("Google Drive connection failed", error);
    return Response.redirect(destination(request, "failed"));
  }
}
