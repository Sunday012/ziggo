import { auth } from "@clerk/nextjs/server";
import { checksumKnowledge, ingestKnowledge } from "@/lib/agent/ingestion";
import { deleteKnowledge } from "@/lib/agent/knowledge";
import { deleteKnowledgeDocument, findKnowledgeDocumentByExternalId } from "@/lib/agent/database";
import { extractKnowledgeFile, MAX_KNOWLEDGE_FILE_BYTES } from "@/lib/agent/document-parser";
import { googleAccessToken } from "@/lib/integrations/google-drive";
import { markIntegrationSync } from "@/lib/integrations/database";

export const runtime = "nodejs";
export const maxDuration = 60;

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; webViewLink?: string };

const downloadable = new Set([
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown", "text/csv", "application/json",
]);

async function readDriveFile(file: DriveFile, token: string) {
  let url: string;
  let name = file.name;
  let mimeType = file.mimeType;
  if (file.mimeType === "application/vnd.google-apps.document") {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text%2Fplain`;
    name = `${name}.txt`; mimeType = "text/plain";
  } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text%2Fcsv`;
    name = `${name}.csv`; mimeType = "text/csv";
  } else if (downloadable.has(file.mimeType)) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  } else return null;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Could not download ${file.name}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_KNOWLEDGE_FILE_BYTES) throw new Error(`${file.name} is larger than 4 MB.`);
  const content = await extractKnowledgeFile(new File([bytes], name, { type: mimeType }));
  return { content, mimeType, byteSize: bytes.byteLength };
}

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try {
    const token = await googleAccessToken(orgId);
    const params = new URLSearchParams({ pageSize: "50", q: "trashed = false", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)" });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Google Drive could not list files.");
    const payload = await response.json() as { files?: DriveFile[] };
    let indexed = 0; let unchanged = 0; let skipped = 0; const failures: string[] = [];
    for (const file of payload.files ?? []) {
      try {
        const parsed = await readDriveFile(file, token);
        if (!parsed) { skipped += 1; continue; }
        const existing = await findKnowledgeDocumentByExternalId(orgId, "google_drive", file.id);
        const checksum = checksumKnowledge(parsed.content);
        if (existing?.checksum === checksum) { unchanged += 1; continue; }
        if (existing) {
          if (existing.chunk_count > 0) await deleteKnowledge(orgId, existing.id, existing.chunk_count);
          await deleteKnowledgeDocument(orgId, existing.id);
        }
        await ingestKnowledge({ orgId, title: file.name, sourceName: file.webViewLink ?? "Google Drive", sourceType: "google_drive", externalId: file.id, ...parsed });
        indexed += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `Could not sync ${file.name}.`);
      }
    }
    await markIntegrationSync(orgId, "google_drive", failures.length && indexed === 0 ? failures[0] : undefined);
    return Response.json({ indexed, unchanged, skipped, failures: failures.slice(0, 5) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive sync failed.";
    await markIntegrationSync(orgId, "google_drive", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
