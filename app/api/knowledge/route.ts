import { auth } from "@clerk/nextjs/server";
import { chunkDocument, indexKnowledge, isKnowledgeConfigured } from "@/lib/agent/knowledge";
import { listKnowledgeDocuments, saveKnowledgeDocument } from "@/lib/agent/database";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  return Response.json({ documents: await listKnowledgeDocuments(orgId), configured: isKnowledgeConfigured() });
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isKnowledgeConfigured()) return Response.json({ error: "Pinecone is not configured." }, { status: 503 });

  const payload = await request.json().catch(() => null) as { title?: string; sourceName?: string; content?: string } | null;
  const title = payload?.title?.trim().slice(0, 120);
  const sourceName = payload?.sourceName?.trim().slice(0, 180) || "Pasted knowledge";
  const content = payload?.content?.trim();
  if (!title || !content || content.length < 40 || content.length > 100_000) {
    return Response.json({ error: "Add a title and 40–100,000 characters of knowledge content." }, { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const chunks = chunkDocument(content);
  await indexKnowledge({ orgId, documentId, title, source: sourceName, chunks });
  await saveKnowledgeDocument({ id: documentId, orgId, title, sourceName, chunkCount: chunks.length });
  return Response.json({ document: { id: documentId, title, source_name: sourceName, status: "ready", chunk_count: chunks.length } }, { status: 201 });
}
