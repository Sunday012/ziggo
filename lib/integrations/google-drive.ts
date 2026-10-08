import "server-only";

import { decryptCredentials, encryptCredentials } from "./crypto";
import { getIntegration, upsertIntegration } from "./database";

export type GoogleCredentials = { accessToken: string; refreshToken: string; expiresAt: number };

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Drive OAuth is not configured.");
  return { clientId, clientSecret };
}

export function googleRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is required for Google Drive OAuth.");
  return `${base}/api/integrations/google-drive/callback`;
}

export function googleAuthorizationUrl(state: string) {
  const { clientId } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleRedirectUri(), grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("Google did not accept the authorization code.");
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  if (!token.refresh_token) throw new Error("Google did not return offline access. Revoke Ziggo in your Google account and connect again.");
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 } satisfies GoogleCredentials;
}

export async function googleAccessToken(orgId: string) {
  const integration = await getIntegration(orgId, "google_drive");
  if (!integration?.encrypted_credentials) throw new Error("Google Drive is not connected.");
  const credentials = decryptCredentials<GoogleCredentials>(integration.encrypted_credentials);
  if (credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: credentials.refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Google Drive access expired. Reconnect the account.");
  const token = await response.json() as { access_token: string; expires_in: number };
  const updated = { ...credentials, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  await upsertIntegration({
    orgId, provider: "google_drive", userId: integration.created_by as string,
    displayName: integration.display_name ?? undefined, externalAccountId: integration.external_account_id ?? undefined,
    encryptedCredentials: encryptCredentials(updated), config: integration.config,
  });
  return updated.accessToken;
}
