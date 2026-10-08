import { auth } from "@clerk/nextjs/server";
import { deleteKnowledge, isKnowledgeConfigured } from "@/lib/agent/knowledge";
import {
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  isPersistenceConfigured,
  listKnowledgeDocuments,
} from "@/lib/agent/database";
import { ingestKnowledge } from "@/lib/agent/ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  return Response.json({
    documents: await listKnowledgeDocuments(orgId),
    configured: isKnowledgeConfigured() && isPersistenceConfigured(),
  });
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isKnowledgeConfigured() || !isPersistenceConfigured()) {
    return Response.json({ error: "Pinecone and Neon must be configured for the knowledge library." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as { title?: string; sourceName?: string; content?: string } | null;
  const title = payload?.title?.trim().slice(0, 120);
  const sourceName = payload?.sourceName?.trim().slice(0, 180) || "Pasted knowledge";
  const content = payload?.content?.trim();
  if (!title || !content || content.length < 40 || content.length > 100_000) {
    return Response.json({ error: "Add a title and 40–100,000 characters of knowledge content." }, { status: 400 });
  }

  try {
    const result = await ingestKnowledge({ orgId, title, sourceName, sourceType: "paste", content });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("Knowledge ingestion failed", error);
    return Response.json({ error: "Knowledge could not be indexed. Check your Pinecone index and try again." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isKnowledgeConfigured() || !isPersistenceConfigured()) {
    return Response.json({ error: "Pinecone and Neon must be configured for the knowledge library." }, { status: 503 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "A valid document ID is required." }, { status: 400 });
  }
  const document = await getKnowledgeDocument(orgId, id);
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

  try {
    if (document.chunk_count > 0) await deleteKnowledge(orgId, id, document.chunk_count);
    await deleteKnowledgeDocument(orgId, id);
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Knowledge deletion failed", error);
    return Response.json({ error: "The document could not be removed. Try again." }, { status: 502 });
  }
}
