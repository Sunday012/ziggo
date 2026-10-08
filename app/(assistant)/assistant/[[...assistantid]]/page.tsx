import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatWorkspace } from "../../_components/chat-workspace";
import { isPersistenceConfigured, listConversations, listKnowledgeDocuments } from "@/lib/agent/database";
import { isKnowledgeConfigured } from "@/lib/agent/knowledge";

export const metadata: Metadata = { title: "Support workspace" };

export default async function AssistantPage() {
  const { userId, orgId } = await auth();

  if (!userId) redirect("/");
  if (!orgId) redirect("/select-org");

  const [conversations, knowledgeDocuments] = await Promise.all([
    listConversations(orgId),
    listKnowledgeDocuments(orgId),
  ]);

  return (
    <ChatWorkspace
      initialConversations={conversations}
      initialKnowledgeDocuments={knowledgeDocuments}
      knowledgeConfigured={isKnowledgeConfigured() && isPersistenceConfigured()}
    />
  );
}
