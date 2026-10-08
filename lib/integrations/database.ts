import "server-only";

import { getAgentDatabase } from "@/lib/agent/database";

export type IntegrationProvider = "google_drive" | "whatsapp";
export type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  status: "disconnected" | "connected" | "error";
  display_name: string | null;
  external_account_id: string | null;
  encrypted_credentials: string | null;
  config: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  created_by: string;
};

export async function listIntegrations(orgId: string) {
  const sql = getAgentDatabase();
  if (!sql) return [];
  return await sql`
    select id, organization_id, provider, status, display_name, external_account_id,
      config, last_synced_at, last_error
    from ziggo_integrations where organization_id = ${orgId} order by provider
  ` as IntegrationRow[];
}

export async function getIntegration(orgId: string, provider: IntegrationProvider) {
  const sql = getAgentDatabase();
  if (!sql) return null;
  const rows = await sql`select * from ziggo_integrations where organization_id = ${orgId} and provider = ${provider} limit 1` as IntegrationRow[];
  return rows[0] ?? null;
}

export async function getIntegrationByExternalAccount(provider: IntegrationProvider, externalAccountId: string) {
  const sql = getAgentDatabase();
  if (!sql) return null;
  const rows = await sql`
    select * from ziggo_integrations where provider = ${provider}
      and external_account_id = ${externalAccountId} and status = 'connected' limit 1
  ` as IntegrationRow[];
  return rows[0] ?? null;
}

export async function upsertIntegration(input: {
  orgId: string; provider: IntegrationProvider; userId: string; displayName?: string;
  externalAccountId?: string; encryptedCredentials: string; config?: Record<string, unknown>;
}) {
  const sql = getAgentDatabase();
  if (!sql) throw new Error("Neon is required for integrations.");
  const rows = await sql`
    insert into ziggo_integrations (
      organization_id, provider, status, display_name, external_account_id,
      encrypted_credentials, config, created_by
    ) values (
      ${input.orgId}, ${input.provider}, 'connected', ${input.displayName ?? null},
      ${input.externalAccountId ?? null}, ${input.encryptedCredentials},
      ${JSON.stringify(input.config ?? {})}::jsonb, ${input.userId}
    ) on conflict (organization_id, provider) do update set
      status = 'connected', display_name = excluded.display_name,
      external_account_id = excluded.external_account_id,
      encrypted_credentials = excluded.encrypted_credentials,
      config = excluded.config, last_error = null, updated_at = now()
    returning *
  `;
  return rows[0] as IntegrationRow;
}

export async function markIntegrationSync(orgId: string, provider: IntegrationProvider, error?: string) {
  const sql = getAgentDatabase();
  if (!sql) return;
  await sql`
    update ziggo_integrations set status = ${error ? "error" : "connected"},
      last_synced_at = ${error ? null : new Date().toISOString()}, last_error = ${error?.slice(0, 500) ?? null}, updated_at = now()
    where organization_id = ${orgId} and provider = ${provider}
  `;
}

export async function disconnectIntegration(orgId: string, provider: IntegrationProvider) {
  const sql = getAgentDatabase();
  if (!sql) return;
  await sql`delete from ziggo_integrations where organization_id = ${orgId} and provider = ${provider}`;
}
