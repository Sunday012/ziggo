import "server-only";

import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_KNOWLEDGE_FILE_BYTES = 4_000_000;
export const MAX_EXTRACTED_CHARACTERS = 400_000;

const supportedExtensions = new Set(["pdf", "docx", "txt", "md", "csv", "json"]);

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function cleanText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function decodeXmlEntities(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (match, entity: string) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const codePoint = entity[1]?.toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : "";
  });
}

async function extractDocxText(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  const document = archive.file("word/document.xml");
  if (!document) throw new Error("The DOCX file does not contain a readable Word document.");
  const xml = await document.async("string");
  if (xml.length > MAX_EXTRACTED_CHARACTERS * 4) {
    throw new Error("The Word document expands beyond the safe processing limit.");
  }
  return decodeXmlEntities(xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, ""));
}

export function isSupportedKnowledgeFile(file: File) {
  return supportedExtensions.has(extensionOf(file.name));
}

export async function extractKnowledgeFile(file: File) {
  if (!isSupportedKnowledgeFile(file)) {
    throw new Error("Upload a PDF, DOCX, TXT, Markdown, CSV, or JSON file.");
  }
  if (file.size === 0 || file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    throw new Error("The file must be larger than 0 bytes and no more than 4 MB.");
  }

  const extension = extensionOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;

  if (extension === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    try {
      if (pdf.numPages > 300) throw new Error("The PDF has more than the 300-page processing limit.");
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    } finally {
      await pdf.cleanup();
    }
  } else if (extension === "docx") {
    text = await extractDocxText(bytes);
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (extension === "json") {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        throw new Error("The JSON file is not valid JSON.");
      }
    }
  }

  const content = cleanText(text);
  if (content.length < 40) throw new Error("The file does not contain enough readable text to index.");
  if (content.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("The extracted document is too long. Split it into smaller files under 400,000 characters.");
  }
  return content;
}
