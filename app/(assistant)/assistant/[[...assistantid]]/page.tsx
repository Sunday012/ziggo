import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatWorkspace } from "../../_components/chat-workspace";

export const metadata: Metadata = { title: "Support workspace" };

export default async function AssistantPage() {
  const { userId, orgId } = await auth();

  if (!userId) redirect("/");
  if (!orgId) redirect("/select-org");

  return <ChatWorkspace />;
}
