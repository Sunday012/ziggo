import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatWorkspace } from "../../_components/chat-workspace";
import { isPersistenceConfigured, listConversations, listKnowledgeCandidates, listKnowledgeDocuments } from "@/lib/agent/database";
import { isKnowledgeConfigured } from "@/lib/agent/knowledge";
import { listIntegrations } from "@/lib/integrations/database";

export const metadata: Metadata = { title: "Support workspace" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { userId, orgId } = await auth();
  const query = await searchParams;

  if (!userId) redirect("/");
  if (!orgId) redirect("/select-org");

  const [conversations, knowledgeDocuments, integrations, knowledgeCandidates] = await Promise.all([
    listConversations(orgId),
    listKnowledgeDocuments(orgId),
    listIntegrations(orgId),
    listKnowledgeCandidates(orgId),
  ]);

  return (
    <ChatWorkspace
      initialConversations={conversations}
      initialKnowledgeDocuments={knowledgeDocuments}
      knowledgeConfigured={isKnowledgeConfigured() && isPersistenceConfigured()}
      initialPanel={query.drive ? "knowledge" : "activity"}
      initialIntegrations={integrations}
      initialKnowledgeCandidates={knowledgeCandidates}
    />
  );
}
