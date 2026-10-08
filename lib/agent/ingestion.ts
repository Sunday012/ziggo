import "server-only";

import { createHash } from "node:crypto";
import {
  createKnowledgeDocument,
  findKnowledgeDocumentByChecksum,
  markKnowledgeDocumentFailed,
  markKnowledgeDocumentReady,
} from "./database";
import { chunkDocument, deleteKnowledge, indexKnowledge } from "./knowledge";

export type KnowledgeSourceType = "paste" | "upload" | "google_drive" | "conversation" | "whatsapp";

export function checksumKnowledge(content: string) {
  return createHash("sha256").update(content.trim()).digest("hex");
}

export async function ingestKnowledge(input: {
  orgId: string;
  title: string;
  sourceName: string;
  sourceType: KnowledgeSourceType;
  content: string;
  mimeType?: string;
  byteSize?: number;
}) {
  const checksum = checksumKnowledge(input.content);
  const duplicate = await findKnowledgeDocumentByChecksum(input.orgId, checksum);
  if (duplicate) return { document: duplicate, duplicate: true };

  const chunks = chunkDocument(input.content);
  if (chunks.length === 0) throw new Error("No searchable text could be extracted.");
  const documentId = crypto.randomUUID();
  await createKnowledgeDocument({
    id: documentId,
    orgId: input.orgId,
    title: input.title,
    sourceName: input.sourceName,
    sourceType: input.sourceType,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    checksum,
  });

  try {
    await indexKnowledge({
      orgId: input.orgId,
      documentId,
      title: input.title,
      source: input.sourceName,
      chunks,
    });
    const document = await markKnowledgeDocumentReady({ id: documentId, orgId: input.orgId, chunkCount: chunks.length });
    if (!document) throw new Error("The indexed document could not be saved.");
    return { document, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge indexing failed.";
    try {
      await deleteKnowledge(input.orgId, documentId, chunks.length);
    } catch (cleanupError) {
      console.error("Incomplete Pinecone records could not be cleaned up", cleanupError);
    }
    await markKnowledgeDocumentFailed({ id: documentId, orgId: input.orgId, error: message });
    throw error;
  }
}
