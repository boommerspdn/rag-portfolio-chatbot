"use client";

import * as React from "react";
import {
  ArrowPathIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

import { ChatMessage, type ChatMessageModel } from "../components/chat-message";
import { SourceCard, type SourceModel } from "../components/source-card";
import { SuggestedQuestions } from "../components/suggested-questions";
import { cn } from "../lib/cn";

type UiMessage = ChatMessageModel & {
  id: string;
  createdAt: Date;
};

type ChatApiSource = SourceModel;

type ChatApiResponse = {
  answer: string;
  sources: ChatApiSource[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function ask(question: string): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}).`);
  }

  const data = (await res.json()) as unknown;
  if (
    typeof data !== "object" ||
    data === null ||
    !("answer" in data) ||
    !("sources" in data) ||
    typeof (data as { answer?: unknown }).answer !== "string" ||
    !Array.isArray((data as { sources?: unknown }).sources)
  ) {
    throw new Error("Invalid response from server.");
  }

  return data as ChatApiResponse;
}

type MobileTab = "chat" | "sources";

export default function Home() {
  const [tab, setTab] = React.useState<MobileTab>("chat");
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [sources, setSources] = React.useState<SourceModel[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const modelLabel = process.env.NEXT_PUBLIC_MODEL_LABEL || "Sonnet 4.6";

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const suggestedQuestions = React.useMemo(
    () => [
      "What’s your tech stack?",
      "Tell me about your RAG experience",
      "What projects have you built?",
    ],
    [],
  );

  const suggestedVisible = messages.length === 0;

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  function autosizeComposer() {
    const el = composerRef.current;
    if (!el) return;

    const style = window.getComputedStyle(el);
    const lineHeightPx = Number.parseFloat(style.lineHeight);
    const paddingTopPx = Number.parseFloat(style.paddingTop);
    const paddingBottomPx = Number.parseFloat(style.paddingBottom);
    const borderTopPx = Number.parseFloat(style.borderTopWidth);
    const borderBottomPx = Number.parseFloat(style.borderBottomWidth);

    // Fallback if computed style returns "normal"
    const safeLineHeight = Number.isFinite(lineHeightPx) && lineHeightPx > 0 ? lineHeightPx : 24;
    const maxHeight =
      safeLineHeight * 9 +
      paddingTopPx +
      paddingBottomPx +
      borderTopPx +
      borderBottomPx;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  React.useEffect(() => {
    autosizeComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  async function onSend(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (isSending) return;

    const userMessage: UiMessage = {
      id: uid(),
      createdAt: new Date(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const data = await ask(trimmed);

      const assistantMessage: UiMessage = {
        id: uid(),
        createdAt: new Date(),
        role: "assistant",
        content: data.answer,
      };

      setSources(data.sources);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const assistantMessage: UiMessage = {
        id: uid(),
        createdAt: new Date(),
        role: "assistant",
        content:
          "Sorry — something went wrong while generating an answer. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  }

  function onReset() {
    setInput("");
    setMessages([]);
    setSources([]);
    setIsSending(false);
    setTab("chat");
  }

  return (
    <div className="h-svh min-h-svh overflow-hidden bg-(--ds-bg) text-(--ds-text)">
      <div className="flex h-full min-h-0 w-full flex-col px-5 md:px-10 py-4 md:py-0">
        {/* Mobile header (full width) */}
        <header className="flex items-start justify-between gap-4 md:hidden">
          <div>
            <div className="text-[22px] md:text-[32px] font-semibold leading-[1.05] tracking-[-0.02em]">
              Sapondanai Thongchua
            </div>
            <div className="mt-1 text-sm leading-6 text-(--ds-muted)">
              Ask me anything about my experience
            </div>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-[10px] border border-(--ds-border) bg-(--ds-panel) px-3 py-2 text-sm font-medium text-(--ds-text) hover:bg-(--ds-hover)"
          >
            <ArrowPathIcon className="h-4 w-4 text-(--ds-muted)" aria-hidden="true" />
            Reset
          </button>
        </header>

        <div className="mt-6 border-b border-(--ds-border) md:hidden">
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium",
                tab === "chat"
                  ? "border-b-2 border-(--ds-accent) text-(--ds-text)"
                  : "text-(--ds-muted)",
              )}
            >
              <ChatBubbleOvalLeftEllipsisIcon
                className={cn(
                  "h-5 w-5",
                  tab === "chat" ? "text-(--ds-text)" : "text-(--ds-muted)",
                )}
                aria-hidden="true"
              />
              Chat
            </button>
            <button
              type="button"
              onClick={() => setTab("sources")}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium",
                tab === "sources"
                  ? "border-b-2 border-(--ds-accent) text-(--ds-text)"
                  : "text-(--ds-muted)",
              )}
            >
              <DocumentTextIcon
                className={cn(
                  "h-5 w-5",
                  tab === "sources" ? "text-(--ds-text)" : "text-(--ds-muted)",
                )}
                aria-hidden="true"
              />
              {`View Sources (${sources.length})`}
            </button>
          </div>
        </div>

        <div className="mt-0 flex-1 min-h-0 md:min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-0 md:grid md:grid-cols-[1fr_360px] md:gap-8">
            <section
              className={cn(
                "flex min-w-0 flex-col min-h-0 h-full md:py-8",
                tab !== "chat" ? "hidden md:flex" : "flex",
              )}
            >
            {/* Desktop/tablet header (left column) */}
            <header className="hidden items-start justify-between gap-4 md:flex">
              <div>
                <div className="text-[32px] font-semibold leading-[1.05] tracking-[-0.02em]">
                  Sapondanai Thongchua
                </div>
                <div className="mt-1 text-sm leading-6 text-(--ds-muted)">
                  Ask me anything about my experience
                </div>
              </div>

              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded-[10px] border border-(--ds-border) bg-(--ds-panel) px-3 py-2 text-sm font-medium text-(--ds-text) hover:bg-(--ds-hover)"
              >
                <ArrowPathIcon className="h-4 w-4 text-(--ds-muted)" aria-hidden="true" />
                Reset
              </button>
            </header>

            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-auto px-0 pb-4 pt-6"
            >
              <div className="space-y-8">
                {messages.map((m) => (
                  <div key={m.id} className="space-y-1">
                    <ChatMessage message={m} />
                    <div
                      className={cn(
                        "text-xs text-(--ds-muted)",
                        m.role === "user" ? "text-right" : "text-left pl-5",
                      )}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <SuggestedQuestions
                questions={suggestedQuestions}
                visible={suggestedVisible}
                onPick={(q) => onSend(q)}
              />

              <form
                className="flex flex-col gap-2 rounded-[12px] border border-(--ds-border) bg-(--ds-panel) px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSend(input);
                }}
              >
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend(input);
                    }
                  }}
                  placeholder="Type your question..."
                  rows={1}
                  className="min-h-10 max-h-[228px] w-full resize-none overflow-x-hidden bg-transparent text-[15px] leading-6 text-(--ds-text) placeholder:text-(--ds-muted) outline-none"
                  disabled={isSending}
                />

                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-(--ds-muted)">
                    {modelLabel}
                  </div>

                  <button
                    type="submit"
                    aria-label="Send message"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--ds-accent) text-white disabled:opacity-50"
                    disabled={isSending || input.trim().length === 0}
                  >
                    <PaperAirplaneIcon className="h-5 w-5 text-white" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>
          </section>

            <aside
              className={cn(
                "min-w-0 md:flex md:h-full md:min-h-0 md:flex-col md:border-l md:border-(--ds-border) md:pl-8 md:py-8",
                tab !== "sources" ? "hidden md:flex" : "block md:flex",
              )}
            >
            {/* Desktop/tablet header (right column) */}
            <div className="pt-6 md:pt-0">
              <div className="text-[17px] font-semibold leading-6">Sources</div>
              <div className="mt-3 h-px w-full bg-(--ds-border)" />
            </div>

            <div className="mt-4 space-y-4 pb-10 md:flex-1 md:min-h-0 md:overflow-auto">
              {sources.length === 0 ? (
                <div className="text-sm leading-6 text-(--ds-muted)">
                  Ask a question to see the supporting sources here.
                </div>
              ) : (
                sources.map((s) => <SourceCard key={s.filename} source={s} />)
              )}
            </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
