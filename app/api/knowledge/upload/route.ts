import { auth } from "@clerk/nextjs/server";
import { extractKnowledgeFile } from "@/lib/agent/document-parser";
import { ingestKnowledge } from "@/lib/agent/ingestion";
import { isPersistenceConfigured } from "@/lib/agent/database";
import { isKnowledgeConfigured } from "@/lib/agent/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_UPLOAD_REQUEST_BYTES = 4_500_000;

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isKnowledgeConfigured() || !isPersistenceConfigured()) {
    return Response.json({ error: "Pinecone and Neon must be configured for the knowledge library." }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_REQUEST_BYTES) {
    return Response.json({ error: "The upload request is too large. Choose a file no larger than 4 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The upload could not be read." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a document to upload." }, { status: 400 });

  const customTitle = form.get("title");
  const fallbackTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const title = (typeof customTitle === "string" ? customTitle.trim() : "").slice(0, 120) || fallbackTitle.slice(0, 120);
  if (!title) return Response.json({ error: "The document needs a title." }, { status: 400 });

  let content: string;
  try {
    content = await extractKnowledgeFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document could not be read.";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const result = await ingestKnowledge({
      orgId,
      title,
      sourceName: file.name.slice(0, 180),
      sourceType: "upload",
      content,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
    });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("Document ingestion failed", error);
    return Response.json({ error: "The document was read but could not be indexed. Check Pinecone and try again." }, { status: 502 });
  }
}
