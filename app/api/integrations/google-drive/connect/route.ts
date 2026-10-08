import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { googleAuthorizationUrl } from "@/lib/integrations/google-drive";

export const runtime = "nodejs";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set("ziggo_google_oauth", `${state}.${orgId}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return Response.redirect(googleAuthorizationUrl(state));
}
