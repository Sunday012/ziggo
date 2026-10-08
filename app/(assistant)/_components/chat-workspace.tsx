"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import {
  ArrowUp,
  Bot,
  CheckCheck,
  Menu,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const suggestions = [
  "Where is my order?",
  "Help me update my account",
  "What is your refund policy?",
];

function createId() {
  return crypto.randomUUID();
}

export function ChatWorkspace() {
  const { organization, isLoaded } = useOrganization();
  const organizationName = organization?.name ?? "your team";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function sendMessage(content: string) {
    const cleanContent = content.trim();
    if (!cleanContent || isStreaming) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: cleanContent };
    const assistantId = createId();
    const outgoingMessages = [...messages, userMessage];

    setDraft("");
    setError(null);
    setIsStreaming(true);
    setMessages([...outgoingMessages, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          messages: outgoingMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(details?.error ?? "The support agent could not respond. Please try again.");
      }

      if (!response.body) throw new Error("The response stream was unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const nextContent = decoder.decode(value, { stream: true });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + nextContent } : item));
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      const message = caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
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
    setMessages([]);
    setDraft("");
    setError(null);
    setIsStreaming(false);
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfaf6]">
      <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-black/7 bg-white/65 px-4 backdrop-blur-xl sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/select-org" className="grid size-10 place-items-center rounded-xl border border-black/8 bg-white text-[#10251d] lg:hidden" aria-label="Choose workspace"><Menu className="size-4" /></Link>
          <div className="grid size-10 place-items-center rounded-xl bg-[#dff6e8] text-[#196b4d]"><Bot className="size-5" /></div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-[-0.01em]">{isLoaded ? `${organizationName} support` : "Loading support agent…"}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-[#6f7e78]"><span className="size-1.5 rounded-full bg-emerald-500" /> AI agent online</p>
          </div>
        </div>
        <button onClick={resetConversation} type="button" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#66756f] transition hover:bg-black/5 hover:text-[#10251d]"><RotateCcw className="size-3.5" /><span className="hidden sm:inline">New conversation</span></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 sm:px-8 sm:py-12">
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-2xl py-8 text-center fade-up">
              <div className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-[#10251d] text-[#dbf97e] shadow-lg"><Sparkles className="size-6" /></div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#196b4d]">{organizationName}&apos;s AI agent</p>
              <h2 className="balance mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">What can I help you solve?</h2>
              <p className="pretty mx-auto mt-4 max-w-lg text-sm leading-6 text-[#66756f]">Start a customer-support conversation below. Your agent will respond with the context and tone of the active workspace.</p>
              <div className="mt-8 grid gap-2 sm:grid-cols-3">
                {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} className="rounded-xl border border-black/8 bg-white px-4 py-3 text-left text-xs font-semibold leading-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#196b4d]/30 hover:bg-[#f4fbf6]">{suggestion}</button>)}
              </div>
            </div>
          ) : (
            <div className="space-y-7 pb-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#10251d] text-[#dbf97e]"><Bot className="size-4" /></span>}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%] ${message.role === "user" ? "rounded-tr-md bg-[#196b4d] text-white" : "rounded-tl-md border border-black/6 bg-white text-[#253a32]"}`}>
                    {message.content || <span className="flex h-6 items-center gap-1.5" aria-label="Agent is typing">{[0, 1, 2].map((dot) => <span key={dot} className="size-1.5 rounded-full bg-[#196b4d]" style={{ animation: `pulse-soft 1s ${dot * 150}ms infinite` }} />)}</span>}
                  </div>
                  {message.role === "user" && <span className="mt-1 hidden size-8 shrink-0 place-items-center rounded-lg bg-[#dff6e8] text-[#196b4d] sm:grid"><UserRound className="size-4" /></span>}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3 sm:px-7 sm:pb-6">
        <div className="mx-auto max-w-4xl">
          {error && <div className="mb-2 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)} className="ml-3 font-bold">Dismiss</button></div>}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_12px_38px_rgba(16,37,29,0.09)] focus-within:border-[#196b4d]/35 focus-within:ring-4 focus-within:ring-[#196b4d]/5">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={`Ask ${organizationName} support…`}
              className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-[#8b9892]"
              aria-label="Message"
            />
            <button type="submit" disabled={!draft.trim() || isStreaming} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#10251d] text-white transition hover:bg-[#196b4d] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send message"><ArrowUp className="size-4" /></button>
          </form>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#8a9691]"><CheckCheck className="size-3" /> AI can make mistakes. Review important information.</div>
        </div>
      </div>
    </section>
  );
}
