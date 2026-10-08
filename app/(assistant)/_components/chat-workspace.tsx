"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import {
  Activity as ActivityIcon,
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  Database,
  FileText,
  History,
  Menu,
  MessageCircle,
  Plus,
  RotateCcw,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { AgentActivity, AgentStreamEvent, ChatMessage, Citation } from "@/lib/agent/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ConversationSummary = { id: string; title: string; updated_at: string };
type KnowledgeDocument = {
  id: string;
  title: string;
  source_name: string;
  source_type: string;
  mime_type?: string | null;
  byte_size?: number | null;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  error_message?: string | null;
  created_at?: string;
  indexed_at?: string | null;
};
type Approval = { id: string; title: string; detail: string; status?: "approved" | "denied" };
type StoredAgentEvent = { id: string; event_type: string; tool_name?: string | null; status: string; input?: { reason?: string }; output?: { resultCount?: number }; created_at?: string };
type Panel = "activity" | "knowledge" | null;
type IntegrationSummary = { provider: "google_drive" | "whatsapp"; status: string; display_name: string | null; last_synced_at: string | null; last_error: string | null };
type KnowledgeCandidate = { id: string; title: string; content: string; source_type: "conversation" | "whatsapp"; created_at: string };

const suggestions = [
  "What does our refund policy say?",
  "Help me troubleshoot a customer issue",
  "I need a human support teammate",
];

function createId() {
  return crypto.randomUUID();
}

function upsertActivity(items: AgentActivity[], next: AgentActivity) {
  const existing = items.findIndex((item) => item.id === next.id);
  if (existing === -1) return [...items, next];
  return items.map((item) => item.id === next.id ? next : item);
}

function sourceLabel(sourceType: string) {
  return ({ upload: "File upload", paste: "Pasted text", google_drive: "Google Drive", conversation: "Approved chat", whatsapp: "Approved WhatsApp chat" } as Record<string, string>)[sourceType] ?? "Knowledge source";
}

export function ChatWorkspace({
  initialConversations,
  initialKnowledgeDocuments,
  knowledgeConfigured,
  initialPanel = "activity",
  initialIntegrations,
  initialKnowledgeCandidates,
}: {
  initialConversations: ConversationSummary[];
  initialKnowledgeDocuments: KnowledgeDocument[];
  knowledgeConfigured: boolean;
  initialPanel?: Panel;
  initialIntegrations: IntegrationSummary[];
  initialKnowledgeCandidates: KnowledgeCandidate[];
}) {
  const { organization, isLoaded } = useOrganization();
  const organizationName = organization?.name ?? "your team";
  const organizationLogo = organization?.imageUrl;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (!response.ok) return;
    const data = await response.json() as { conversations?: ConversationSummary[] };
    setConversations(data.conversations ?? []);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function loadConversation(id: string) {
    if (isStreaming) return;
    const response = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`);
    if (!response.ok) return;
    const data = await response.json() as { messages?: ChatMessage[]; events?: StoredAgentEvent[] };
    setConversationId(id);
    setMessages(data.messages ?? []);
    setActivities((data.events ?? []).map((event) => ({
      id: event.id,
      type: event.event_type === "approval" ? "approval" : event.event_type === "tool_call" ? "tool" : "complete",
      title: event.event_type === "approval"
        ? "Human handoff review"
        : event.tool_name === "search_knowledge_base"
          ? "Knowledge search complete"
          : "Agent response recorded",
      detail: event.event_type === "approval"
        ? event.input?.reason
        : event.output?.resultCount !== undefined
          ? `${event.output.resultCount} sources found`
          : undefined,
      status: (["pending", "approved", "denied"].includes(event.status) ? event.status : "completed") as AgentActivity["status"],
      createdAt: event.created_at,
    })));
    setCitations([]);
    setApprovals((data.events ?? [])
      .filter((event) => event.event_type === "approval")
      .map((event) => ({
        id: event.id,
        title: "Human handoff",
        detail: event.input?.reason ?? "A human teammate was requested.",
        status: event.status === "approved" || event.status === "denied" ? event.status : undefined,
      })));
  }

  async function sendMessage(content: string) {
    const cleanContent = content.trim();
    if (!cleanContent || isStreaming) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: cleanContent };
    const assistantId = createId();
    const outgoingMessages = [...messages, userMessage];
    const activeConversationId = conversationId ?? createId();
    setConversationId(activeConversationId);
    setDraft("");
    setError(null);
    setActivities([]);
    setCitations([]);
    setApprovals([]);
    setIsStreaming(true);
    setMessages([...outgoingMessages, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName, conversationId: activeConversationId, messages: outgoingMessages }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(details?.error ?? "The support agent could not respond.");
      }
      if (!response.body) throw new Error("The agent event stream was unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentStreamEvent;
          if (event.type === "conversation") setConversationId(event.conversationId);
          if (event.type === "activity") setActivities((current) => upsertActivity(current, event.activity));
          if (event.type === "citations") setCitations((current) => [...current, ...event.citations.filter((citation) => !current.some((item) => item.id === citation.id))]);
          if (event.type === "approval") setApprovals((current) => [...current, event.approval]);
          if (event.type === "delta") setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + event.content } : item));
          if (event.type === "error") throw new Error(event.error);
        }
      }
      await refreshConversations();
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      const message = caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId || item.content));
      setActivities((current) => [...current, { id: createId(), type: "error", title: "Agent run stopped", detail: message, status: "completed" }]);
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  async function decideApproval(id: string, decision: "approved" | "denied") {
    const response = await fetch("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: id, decision }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "The approval could not be updated.");
      return;
    }
    setApprovals((current) => current.map((item) => item.id === id ? { ...item, status: decision } : item));
    setActivities((current) => current.map((item) => item.id === id ? { ...item, status: decision, title: decision === "approved" ? "Human handoff approved" : "Human handoff declined" } : item));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  function resetConversation() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setActivities([]);
    setCitations([]);
    setApprovals([]);
    setIsStreaming(false);
  }

  return (
    <section className="flex min-w-0 flex-1 bg-[#fbfaf6]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-black/7 bg-white/65 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/select-org" className="grid size-10 place-items-center rounded-xl border border-black/8 bg-white text-[#10251d] lg:hidden" aria-label="Choose workspace"><Menu className="size-4" /></Link>
            <OrganizationAvatar name={organizationName} imageUrl={organizationLogo} size="header" />
            <div className="min-w-0"><h1 className="truncate text-sm font-bold tracking-[-0.01em]">{isLoaded ? `${organizationName} support` : "Loading support agent…"}</h1><p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-[#6f7e78]"><span className="size-1.5 rounded-full bg-emerald-500" /> Tools online · approval controlled</p></div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPanel(panel === "knowledge" ? null : "knowledge")} type="button" className={`grid size-9 place-items-center rounded-lg transition sm:flex sm:w-auto sm:gap-2 sm:px-3 ${panel === "knowledge" ? "bg-[#dff6e8] text-[#196b4d]" : "text-[#66756f] hover:bg-black/5"}`} aria-label="Knowledge base"><Database className="size-3.5" /><span className="hidden text-xs font-semibold sm:inline">Knowledge</span></button>
            <button onClick={() => setPanel(panel === "activity" ? null : "activity")} type="button" className={`grid size-9 place-items-center rounded-lg transition sm:flex sm:w-auto sm:gap-2 sm:px-3 ${panel === "activity" ? "bg-[#dff6e8] text-[#196b4d]" : "text-[#66756f] hover:bg-black/5"}`} aria-label="Agent activity"><ActivityIcon className="size-3.5" /><span className="hidden text-xs font-semibold sm:inline">Activity</span></button>
            <button onClick={resetConversation} type="button" className="grid size-9 place-items-center rounded-lg text-[#66756f] transition hover:bg-black/5 hover:text-[#10251d]" aria-label="New conversation"><RotateCcw className="size-3.5" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 sm:px-8 sm:py-12">
            {messages.length === 0 ? (
              <div className="m-auto w-full max-w-2xl py-8 text-center fade-up">
                <Image src="/ziggo-mark.png" alt="Ziggo" width={64} height={64} className="mx-auto size-16 rounded-[1.4rem] shadow-lg" priority />
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#196b4d]">Tool-using support agent</p>
                <h2 className="balance mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Ask. Retrieve. Resolve.</h2>
                <p className="pretty mx-auto mt-4 max-w-lg text-sm leading-6 text-[#66756f]">Ziggo can search approved company knowledge, explain its work, remember conversations, and ask before creating a human handoff.</p>
                <div className="mt-8 grid gap-2 sm:grid-cols-3">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} className="rounded-xl border border-black/8 bg-white px-4 py-3 text-left text-xs font-semibold leading-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#196b4d]/30 hover:bg-[#f4fbf6]">{suggestion}</button>)}</div>
              </div>
            ) : (
              <div className="space-y-7 pb-6">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && <OrganizationAvatar name={organizationName} imageUrl={organizationLogo} size="message" />}
                    <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%] ${message.role === "user" ? "rounded-tr-md bg-[#196b4d] text-white" : "rounded-tl-md border border-black/6 bg-white text-[#253a32]"}`}>
                      {message.content || <span className="flex h-6 items-center gap-1.5" aria-label="Agent is working">{[0, 1, 2].map((dot) => <span key={dot} className="size-1.5 rounded-full bg-[#196b4d]" style={{ animation: `pulse-soft 1s ${dot * 150}ms infinite` }} />)}</span>}
                    </div>
                    {message.role === "user" && <span className="mt-1 hidden size-8 shrink-0 place-items-center rounded-lg bg-[#dff6e8] text-[#196b4d] sm:grid"><UserRound className="size-4" /></span>}
                  </div>
                ))}
                {citations.length > 0 && <div className="ml-11 grid gap-2 sm:grid-cols-2">{citations.map((citation, index) => <div key={citation.id} className="rounded-xl border border-black/7 bg-white/70 p-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#196b4d]"><FileText className="size-3" /> Source {index + 1}</div><p className="mt-1.5 truncate text-xs font-semibold">{citation.title}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#66756f]">{citation.excerpt}</p></div>)}</div>}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3 sm:px-7 sm:pb-6">
          <div className="mx-auto max-w-4xl">
            {error && <div className="mb-2 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)} className="ml-3 font-bold">Dismiss</button></div>}
            <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_12px_38px_rgba(16,37,29,0.09)] focus-within:border-[#196b4d]/35 focus-within:ring-4 focus-within:ring-[#196b4d]/5">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={4_000} placeholder={`Ask ${organizationName} support…`} className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-[#8b9892]" aria-label="Message" />
              <button type="submit" disabled={!draft.trim() || isStreaming} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#10251d] text-white transition hover:bg-[#196b4d] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send message"><ArrowUp className="size-4" /></button>
            </form>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#8a9691]"><ShieldCheck className="size-3" /> Grounded answers · human approval before handoff</div>
          </div>
        </div>
      </div>

      {panel && <AgentPanel panel={panel} onClose={() => setPanel(null)} conversations={conversations} activeConversationId={conversationId} onConversation={(id) => void loadConversation(id)} activities={activities} approvals={approvals} onApproval={(id, decision) => void decideApproval(id, decision)} initialKnowledgeDocuments={initialKnowledgeDocuments} knowledgeConfigured={knowledgeConfigured} initialIntegrations={initialIntegrations} initialKnowledgeCandidates={initialKnowledgeCandidates} />}
    </section>
  );
}

function OrganizationAvatar({ name, imageUrl, size }: { name: string; imageUrl?: string; size: "header" | "message" }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Avatar className={`shrink-0 rounded-xl border border-black/7 bg-white ${size === "header" ? "size-10" : "mt-1 size-8"}`}>
      <AvatarImage src={imageUrl} alt={`${name} logo`} className="object-cover" />
      <AvatarFallback className="rounded-xl bg-[#dff6e8] text-[10px] font-black text-[#196b4d]">{initials}</AvatarFallback>
    </Avatar>
  );
}

function AgentPanel(props: {
  panel: Exclude<Panel, null>;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onConversation: (id: string) => void;
  activities: AgentActivity[];
  approvals: Approval[];
  onApproval: (id: string, decision: "approved" | "denied") => void;
  initialKnowledgeDocuments: KnowledgeDocument[];
  knowledgeConfigured: boolean;
  initialIntegrations: IntegrationSummary[];
  initialKnowledgeCandidates: KnowledgeCandidate[];
}) {
  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[390px] flex-col border-l border-black/8 bg-[#f7f5ef] shadow-[-20px_0_60px_rgba(16,37,29,0.08)] lg:relative lg:z-auto lg:shadow-none">
      <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-black/7 px-5"><div><p className="text-sm font-bold">{props.panel === "activity" ? "Agent activity" : "Knowledge base"}</p><p className="mt-0.5 text-[10px] text-[#75837d]">{props.panel === "activity" ? "Tools, approvals, and history" : "Approved sources for grounded answers"}</p></div><button type="button" onClick={props.onClose} className="grid size-9 place-items-center rounded-lg hover:bg-black/5" aria-label="Close panel"><X className="size-4" /></button></div>
      {props.panel === "activity" ? <ActivityPanel {...props} /> : <KnowledgePanel initialDocuments={props.initialKnowledgeDocuments} configured={props.knowledgeConfigured} activeConversationId={props.activeConversationId} initialIntegrations={props.initialIntegrations} initialCandidates={props.initialKnowledgeCandidates} />}
    </aside>
  );
}

function ActivityPanel(props: Pick<Parameters<typeof AgentPanel>[0], "activities" | "approvals" | "conversations" | "activeConversationId" | "onConversation" | "onApproval">) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4">
    {props.approvals.map((approval) => <div key={approval.id} className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-amber-900"><CircleAlert className="size-4" /> {approval.title}</div><p className="mt-2 text-xs leading-5 text-amber-800/75">{approval.detail}</p>{approval.status ? <div className="mt-3 flex items-center gap-2 text-xs font-bold capitalize text-amber-900"><Check className="size-3.5" /> {approval.status}</div> : <div className="mt-3 flex gap-2"><button type="button" onClick={() => props.onApproval(approval.id, "approved")} className="rounded-lg bg-[#10251d] px-3 py-2 text-xs font-bold text-white">Approve handoff</button><button type="button" onClick={() => props.onApproval(approval.id, "denied")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900">Decline</button></div>}</div>)}
    <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75837d]"><ActivityIcon className="size-3" /> Current run</div>
    <div className="mt-3 space-y-2">{props.activities.length ? props.activities.map((item) => <div key={item.id} className="rounded-xl border border-black/7 bg-white p-3"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${item.status === "running" ? "animate-pulse bg-amber-400" : item.status === "pending" ? "bg-amber-500" : item.type === "error" ? "bg-red-500" : "bg-emerald-500"}`} /><p className="text-xs font-bold">{item.title}</p></div>{item.detail && <p className="mt-1.5 pl-4 text-[11px] leading-4 text-[#75837d]">{item.detail}</p>}</div>) : <p className="rounded-xl border border-dashed border-black/10 px-4 py-5 text-center text-xs text-[#8a9691]">Agent steps will appear here.</p>}</div>
    <div className="mt-7 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75837d]"><History className="size-3" /> Recent conversations</div>
    <div className="mt-3 space-y-1">{props.conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => props.onConversation(conversation.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition ${props.activeConversationId === conversation.id ? "bg-[#dff6e8] text-[#196b4d]" : "hover:bg-white"}`}><span className="min-w-0 flex-1 truncate font-semibold">{conversation.title}</span><ChevronRight className="size-3.5 shrink-0 opacity-40" /></button>)}</div>
  </div>;
}

function KnowledgePanel({ initialDocuments, configured, activeConversationId, initialIntegrations, initialCandidates }: { initialDocuments: KnowledgeDocument[]; configured: boolean; activeConversationId: string | null; initialIntegrations: IntegrationSummary[]; initialCandidates: KnowledgeCandidate[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(initialDocuments);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>(initialIntegrations);
  const [candidates, setCandidates] = useState<KnowledgeCandidate[]>(initialCandidates);
  const [syncing, setSyncing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppToken, setWhatsAppToken] = useState("");
  const [whatsAppPhoneId, setWhatsAppPhoneId] = useState("");
  const [whatsAppName, setWhatsAppName] = useState("");

  const refreshConnectorData = useCallback(async () => {
    const [integrationResponse, candidateResponse] = await Promise.all([fetch("/api/integrations"), fetch("/api/knowledge/candidates")]);
    if (integrationResponse.ok) setIntegrations(((await integrationResponse.json()) as { integrations?: IntegrationSummary[] }).integrations ?? []);
    if (candidateResponse.ok) setCandidates(((await candidateResponse.json()) as { candidates?: KnowledgeCandidate[] }).candidates ?? []);
  }, []);

  async function syncDrive() {
    setSyncing(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/integrations/google-drive/sync", { method: "POST" });
      const data = await response.json() as { error?: string; indexed?: number; unchanged?: number; failures?: string[] };
      if (!response.ok) { setError(data.error ?? "Google Drive could not be synchronized."); return; }
      setNotice(`Google Drive sync complete: ${data.indexed ?? 0} indexed, ${data.unchanged ?? 0} unchanged${data.failures?.length ? `, ${data.failures.length} skipped with errors` : ""}.`);
      const documentsResponse = await fetch("/api/knowledge");
      if (documentsResponse.ok) setDocuments(((await documentsResponse.json()) as { documents?: KnowledgeDocument[] }).documents ?? []);
      await refreshConnectorData();
    } finally { setSyncing(false); }
  }

  async function connectWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSaving(true); setError(null);
    try {
      const response = await fetch("/api/integrations/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: whatsAppToken, phoneNumberId: whatsAppPhoneId, businessName: whatsAppName }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "WhatsApp could not be connected."); return; }
      setWhatsAppToken(""); setShowWhatsApp(false); setNotice("WhatsApp connected for secure inbound conversation capture."); await refreshConnectorData();
    } finally { setIsSaving(false); }
  }

  async function createCandidate() {
    if (!activeConversationId) return;
    setReviewingId(activeConversationId); setError(null);
    const response = await fetch("/api/knowledge/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", conversationId: activeConversationId }) });
    const data = await response.json() as { error?: string; candidate?: KnowledgeCandidate };
    if (!response.ok) setError(data.error ?? "The conversation could not be added for review.");
    else { setNotice("Conversation added to the knowledge review queue."); await refreshConnectorData(); }
    setReviewingId(null);
  }

  async function reviewCandidate(id: string, action: "approve" | "reject") {
    setReviewingId(id); setError(null);
    const response = await fetch("/api/knowledge/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, candidateId: id }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? "The review could not be completed.");
    else { setCandidates((current) => current.filter((item) => item.id !== id)); setNotice(action === "approve" ? "Conversation approved and indexed." : "Conversation rejected."); }
    setReviewingId(null);
  }

  const googleDrive = integrations.find((item) => item.provider === "google_drive");
  const whatsApp = integrations.find((item) => item.provider === "whatsapp");

  function addDocument(document: KnowledgeDocument, duplicate?: boolean) {
    setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
    setNotice(duplicate ? "That content was already indexed, so Ziggo kept the existing source." : "Source indexed and ready for the agent.");
  }

  async function addKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, sourceName, content }) });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        setError(failure?.error ?? "Knowledge could not be indexed.");
        return;
      }
      const data = await response.json() as { document?: KnowledgeDocument; duplicate?: boolean };
      if (!data.document) { setError("Knowledge could not be indexed."); return; }
      addDocument(data.document, data.duplicate);
      setTitle(""); setSourceName(""); setContent("");
    } catch {
      setError("Knowledge could not be indexed. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      const response = await fetch("/api/knowledge/upload", { method: "POST", body: form });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        setError(failure?.error ?? "The document could not be indexed.");
        return;
      }
      const data = await response.json() as { document?: KnowledgeDocument; duplicate?: boolean };
      if (!data.document) { setError("The document could not be indexed."); return; }
      addDocument(data.document, data.duplicate);
      setTitle("");
      setFile(null);
      const input = document.getElementById("knowledge-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch {
      setError("The document could not be uploaded. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeKnowledge(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setRemovingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setError(data?.error ?? "The source could not be removed.");
        return;
      }
      setDocuments((current) => current.filter((item) => item.id !== id));
      setNotice("Source removed from the agent's knowledge.");
    } catch {
      setError("The source could not be removed. Check your connection and try again.");
    } finally {
      setRemovingId(null);
      setConfirmingId(null);
    }
  }

  return <div className="min-h-0 flex-1 overflow-y-auto p-4">
    {!configured && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Add both Neon and Pinecone credentials, then run the latest database migrations to enable the knowledge library.</div>}
    <div className="mb-4 rounded-2xl border border-black/7 bg-white p-4">
      <div><p className="text-xs font-bold">Connected sources</p><p className="mt-1 text-[10px] leading-4 text-[#75837d]">Bring company content and customer conversations into one reviewed knowledge flow.</p></div>
      <div className="mt-4 space-y-2">
        <div className="rounded-xl border border-black/7 p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Cloud className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold">Google Drive</p><p className="truncate text-[10px] text-[#75837d]">{googleDrive ? googleDrive.display_name : "Docs, PDFs, Word files, CSV, and text"}</p></div>{googleDrive ? <button type="button" disabled={syncing} onClick={() => void syncDrive()} className="grid size-8 place-items-center rounded-lg bg-[#edf7f1] text-[#196b4d] disabled:opacity-50" aria-label="Sync Google Drive"><RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} /></button> : <button type="button" onClick={() => router.push("/api/integrations/google-drive/connect")} className="rounded-lg bg-[#10251d] px-3 py-2 text-[10px] font-bold text-white">Connect</button>}</div></div>
        <div className="rounded-xl border border-black/7 p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><MessageCircle className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold">WhatsApp</p><p className="truncate text-[10px] text-[#75837d]">{whatsApp ? `${whatsApp.display_name} · inbound capture` : "Capture chats for human-reviewed learning"}</p></div>{!whatsApp && <button type="button" onClick={() => setShowWhatsApp((value) => !value)} className="rounded-lg bg-[#10251d] px-3 py-2 text-[10px] font-bold text-white">Connect</button>}</div>{showWhatsApp && !whatsApp && <form onSubmit={connectWhatsApp} className="mt-3 space-y-2 border-t border-black/6 pt-3"><label htmlFor="whatsapp-business" className="sr-only">Business name</label><input id="whatsapp-business" value={whatsAppName} onChange={(event) => setWhatsAppName(event.target.value)} placeholder="Business name" className="h-9 w-full rounded-lg border border-black/10 px-3 text-xs" /><label htmlFor="whatsapp-phone-id" className="sr-only">Phone number ID</label><input id="whatsapp-phone-id" value={whatsAppPhoneId} onChange={(event) => setWhatsAppPhoneId(event.target.value)} placeholder="Phone number ID" className="h-9 w-full rounded-lg border border-black/10 px-3 text-xs" /><label htmlFor="whatsapp-token" className="sr-only">Permanent system-user access token</label><input id="whatsapp-token" type="password" autoComplete="off" value={whatsAppToken} onChange={(event) => setWhatsAppToken(event.target.value)} placeholder="Permanent system-user access token" className="h-9 w-full rounded-lg border border-black/10 px-3 text-xs" /><button type="submit" disabled={isSaving || !whatsAppToken || !whatsAppPhoneId} className="h-9 w-full rounded-lg bg-[#196b4d] text-[10px] font-bold text-white disabled:opacity-40">Verify and connect</button><p className="text-[9px] leading-4 text-[#75837d]">Webhook path: /api/webhooks/whatsapp</p></form>}</div>
      </div>
    </div>
    <div className="mb-4 rounded-2xl border border-black/7 bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Conversation review</p><p className="mt-1 text-[10px] text-[#75837d]">Nothing is learned until a teammate approves it.</p></div>{activeConversationId && <button type="button" disabled={reviewingId === activeConversationId} onClick={() => void createCandidate()} className="rounded-lg bg-[#edf7f1] px-3 py-2 text-[10px] font-bold text-[#196b4d]">Review current chat</button>}</div><div className="mt-3 space-y-2">{candidates.map((candidate) => <div key={candidate.id} className="rounded-xl bg-[#f7f8f5] p-3"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[11px] font-bold">{candidate.title}</p><span className="text-[9px] font-bold uppercase text-[#75837d]">{candidate.source_type}</span></div><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-[#75837d]">{candidate.content}</p><div className="mt-2 flex gap-2"><button type="button" disabled={reviewingId === candidate.id} onClick={() => void reviewCandidate(candidate.id, "approve")} className="rounded-md bg-[#196b4d] px-2.5 py-1.5 text-[9px] font-bold text-white">Approve & index</button><button type="button" disabled={reviewingId === candidate.id} onClick={() => void reviewCandidate(candidate.id, "reject")} className="rounded-md border border-black/10 px-2.5 py-1.5 text-[9px] font-bold">Reject</button></div></div>)}{candidates.length === 0 && <p className="rounded-lg border border-dashed border-black/10 px-3 py-3 text-center text-[10px] text-[#8a9691]">No conversations waiting for review.</p>}</div></div>
    <div className="rounded-2xl border border-black/7 bg-white p-4">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold">Add approved knowledge</p><p className="mt-1 text-[10px] text-[#75837d]">Only reviewed company content should become an agent source.</p></div><Database className="size-4 text-[#196b4d]" /></div>
      <div className="mt-4 grid grid-cols-2 rounded-lg bg-[#f2f5f3] p-1 text-[11px] font-bold"><button type="button" onClick={() => { setMode("upload"); setError(null); }} className={`rounded-md py-2 transition ${mode === "upload" ? "bg-white text-[#153c2d] shadow-sm" : "text-[#75837d]"}`}>Upload file</button><button type="button" onClick={() => { setMode("paste"); setError(null); }} className={`rounded-md py-2 transition ${mode === "paste" ? "bg-white text-[#153c2d] shadow-sm" : "text-[#75837d]"}`}>Paste text</button></div>
      {mode === "upload" ? <form onSubmit={uploadKnowledge}><label htmlFor="knowledge-file" className="mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#196b4d]/25 bg-[#f5fbf7] px-4 text-center transition hover:border-[#196b4d]/50"><Upload className="size-5 text-[#196b4d]" /><span className="mt-2 text-xs font-bold text-[#153c2d]">{file ? file.name : "Choose a document"}</span><span className="mt-1 text-[10px] text-[#75837d]">PDF, DOCX, TXT, MD, CSV, or JSON · up to 4 MB</span></label><input id="knowledge-file" type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" /><label htmlFor="upload-title" className="sr-only">Custom document title</label><input id="upload-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Custom title (optional)" maxLength={120} className="mt-2 h-10 w-full rounded-lg border border-black/10 px-3 text-xs outline-none focus:border-[#196b4d]/50" /><button type="submit" disabled={!configured || isSaving || !file} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10251d] text-xs font-bold text-white disabled:opacity-40"><Upload className="size-3.5" /> {isSaving ? "Reading and indexing…" : "Upload and index"}</button></form> : <form onSubmit={addKnowledge}><label htmlFor="knowledge-title" className="sr-only">Document title</label><input id="knowledge-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Document title" maxLength={120} className="mt-3 h-10 w-full rounded-lg border border-black/10 px-3 text-xs outline-none focus:border-[#196b4d]/50" /><label htmlFor="knowledge-source" className="sr-only">Source name or URL</label><input id="knowledge-source" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Source name or URL (optional)" maxLength={180} className="mt-2 h-10 w-full rounded-lg border border-black/10 px-3 text-xs outline-none focus:border-[#196b4d]/50" /><label htmlFor="knowledge-content" className="sr-only">Knowledge content</label><textarea id="knowledge-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste policies, product details, troubleshooting guides, or FAQs…" rows={7} maxLength={100_000} className="mt-2 w-full resize-y rounded-lg border border-black/10 p-3 text-xs leading-5 outline-none focus:border-[#196b4d]/50" /><button type="submit" disabled={!configured || isSaving || title.trim().length === 0 || content.trim().length < 40} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10251d] text-xs font-bold text-white disabled:opacity-40"><Plus className="size-3.5" /> {isSaving ? "Chunking and indexing…" : "Index knowledge"}</button></form>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">{notice}</p>}
    </div>
    <div className="mt-6 flex items-center justify-between px-1"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75837d]"><Search className="size-3" /> Source library</div><span className="text-[10px] text-[#8a9691]">{documents.length} {documents.length === 1 ? "source" : "sources"}</span></div>
    <div className="mt-3 space-y-2">{documents.map((item) => <div key={item.id} className="rounded-xl border border-black/7 bg-white p-3"><div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-[#196b4d]" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs font-bold">{item.title}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${item.status === "ready" ? "bg-emerald-50 text-emerald-700" : item.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></div><p className="mt-1 truncate text-[10px] text-[#75837d]">{item.source_name}</p><p className="mt-1 text-[10px] text-[#9aa49f]">{sourceLabel(item.source_type)} · {item.chunk_count} chunks{item.byte_size ? ` · ${(item.byte_size / 1024).toFixed(item.byte_size > 102_400 ? 0 : 1)} KB` : ""}</p>{item.error_message && <p className="mt-2 text-[10px] leading-4 text-red-600">{item.error_message}</p>}</div><button type="button" disabled={removingId === item.id} onBlur={() => confirmingId === item.id && setConfirmingId(null)} onClick={() => void removeKnowledge(item.id)} aria-label={confirmingId === item.id ? `Confirm removal of ${item.title}` : `Remove ${item.title}`} className={`shrink-0 rounded-lg p-2 transition disabled:opacity-40 ${confirmingId === item.id ? "bg-red-50 text-red-700" : "text-[#9aa49f] hover:bg-red-50 hover:text-red-700"}`}>{confirmingId === item.id ? <span className="text-[9px] font-bold">Confirm</span> : <Trash2 className="size-3.5" />}</button></div></div>)}{documents.length === 0 && <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-xs leading-5 text-[#8a9691]">No sources yet. Upload a policy, guide, or FAQ to give the agent trusted context.</p>}</div>
  </div>;
}
