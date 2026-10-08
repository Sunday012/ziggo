import "server-only";

import { Pinecone } from "@pinecone-database/pinecone";
import type { Citation } from "./types";

type KnowledgeRecord = {
  text: string;
  title: string;
  source: string;
  document_id: string;
  chunk_index: number;
};

let pinecone: Pinecone | null | undefined;

function getPinecone() {
  if (pinecone !== undefined) return pinecone;
  pinecone = process.env.PINECONE_API_KEY ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY }) : null;
  return pinecone;
}

function namespaceFor(orgId: string) {
  return `org-${orgId.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 63);
}

function getIndex() {
  const client = getPinecone();
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!client || !indexName) return null;
  return client.index<KnowledgeRecord>(indexName);
}

export function isKnowledgeConfigured() {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME);
}

export function chunkDocument(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let cursor = 0;
  const size = 1_400;
  const overlap = 180;

  while (cursor < normalized.length) {
    let end = Math.min(cursor + size, normalized.length);
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end);
      const sentenceBreak = normalized.lastIndexOf(". ", end);
      const preferredBreak = Math.max(paragraphBreak, sentenceBreak);
      if (preferredBreak > cursor + 700) end = preferredBreak + 1;
    }
    chunks.push(normalized.slice(cursor, end).trim());
    if (end >= normalized.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks.filter(Boolean).slice(0, 80);
}

export async function indexKnowledge(input: {
  orgId: string;
  documentId: string;
  title: string;
  source: string;
  chunks: string[];
}) {
  const index = getIndex();
  if (!index) throw new Error("Pinecone is not configured.");
  await index.upsertRecords({
    namespace: namespaceFor(input.orgId),
    records: input.chunks.map((text, chunkIndex) => ({
      _id: `${input.documentId}#${chunkIndex}`,
      text,
      title: input.title,
      source: input.source,
      document_id: input.documentId,
      chunk_index: chunkIndex,
    })),
  });
}

export async function searchKnowledge(orgId: string, query: string): Promise<Citation[]> {
  const index = getIndex();
  if (!index) return [];
  const response = await index.searchRecords({
    namespace: namespaceFor(orgId),
    query: { inputs: { text: query }, topK: 6 },
    fields: ["text", "title", "source", "document_id", "chunk_index"],
    rerank: {
      model: "bge-reranker-v2-m3",
      rankFields: ["text"],
      topN: 4,
    },
  });

  return response.result.hits.map((hit) => {
    const fields = hit.fields as Partial<KnowledgeRecord>;
    return {
      id: hit._id,
      title: fields.title ?? fields.source ?? "Knowledge base",
      excerpt: (fields.text ?? "").slice(0, 320),
      score: hit._score,
    };
  });
}
