export type ChatRole = "assistant" | "user";

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
};

export type Citation = {
  id: string;
  title: string;
  excerpt: string;
  score: number;
};

export type AgentActivity = {
  id: string;
  type: "thinking" | "tool" | "approval" | "complete" | "error";
  title: string;
  detail?: string;
  status?: "running" | "completed" | "pending" | "approved" | "denied";
  createdAt?: string;
};

export type AgentStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "activity"; activity: AgentActivity }
  | { type: "citations"; citations: Citation[] }
  | { type: "approval"; approval: { id: string; title: string; detail: string } }
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; error: string };
