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
import { ScrollArea } from "../components/ui/scroll-area";
import { SuggestedQuestions } from "../components/suggested-questions";
import { streamChat, type ChatHistoryMessage } from "../lib/chat-stream";
import { cn } from "../lib/cn";
import { clientEnv, clientEnvError } from "../lib/env";

type UiMessage = ChatMessageModel & {
  id: string;
  createdAt: Date;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type MobileTab = "chat" | "sources";

const ERROR_ASSISTANT_COPY =
  "Sorry — something went wrong while generating an answer. Please try again.";

function toHistoryMessage(m: ChatMessageModel): ChatHistoryMessage | null {
  const content = m.content.trim();
  if (!content) return null;
  return { role: m.role, content };
}

export default function Home() {
  const [tab, setTab] = React.useState<MobileTab>("chat");
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [sources, setSources] = React.useState<SourceModel[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const modelLabel = clientEnv.NEXT_PUBLIC_MODEL_LABEL;
  const hasApiUrl = clientEnv.NEXT_PUBLIC_API_URL.length > 0;

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const suggestedQuestions = React.useMemo(
    () => [
      "What’s your tech stack?",
      "Tell me about your RAG experience",
      "What projects have you built?",
    ],
    [],
  );

  const suggestedVisible = messages.length === 0;
  const canSend = hasApiUrl && !isSending && input.trim().length > 0;

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function autosizeComposer() {
    const el = composerRef.current;
    if (!el) return;

    const style = window.getComputedStyle(el);
    const lineHeightPx = Number.parseFloat(style.lineHeight);
    const paddingTopPx = Number.parseFloat(style.paddingTop);
    const paddingBottomPx = Number.parseFloat(style.paddingBottom);
    const borderTopPx = Number.parseFloat(style.borderTopWidth);
    const borderBottomPx = Number.parseFloat(style.borderBottomWidth);

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

    const assistantId = uid();
    const assistantMessage: UiMessage = {
      id: assistantId,
      createdAt: new Date(),
      role: "assistant",
      content: "",
    };

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsSending(true);
    setStreamingId(assistantId);

    try {
      const history: ChatHistoryMessage[] = [...messages, userMessage]
        .map(toHistoryMessage)
        .filter((m): m is ChatHistoryMessage => m !== null)
        .slice(-20);

      await streamChat(trimmed, history, {
        signal: abortController.signal,
        onSources: (next) => {
          setSources(next);
        },
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m,
            ),
          );
        },
      });
    } catch {
      if (abortController.signal.aborted) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: ERROR_ASSISTANT_COPY } : m,
        ),
      );
    } finally {
      if (!abortController.signal.aborted) {
        setStreamingId(null);
        setIsSending(false);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }

  function onReset() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setInput("");
    setMessages([]);
    setSources([]);
    setIsSending(false);
    setStreamingId(null);
    setTab("chat");
  }

  return (
    <div className="h-svh min-h-svh overflow-hidden bg-(--ds-bg) text-(--ds-text)">
      <div className="flex h-full min-h-0 w-full flex-col px-5 md:px-10 py-4 md:py-0">
        {!hasApiUrl ? (
          <div className="mb-4 rounded-[12px] border border-(--ds-border) bg-(--ds-panel) px-4 py-3 text-sm text-(--ds-text)">
            <div className="font-semibold">Configuration needed</div>
            <div className="mt-1 text-(--ds-muted)">
              Set <span className="font-mono">NEXT_PUBLIC_API_URL</span> in{" "}
              <span className="font-mono">apps/web/.env</span> (see{" "}
              <span className="font-mono">apps/web/.env.example</span>).
            </div>
            {clientEnvError?.NEXT_PUBLIC_API_URL?.length ? (
              <div className="mt-2 text-xs text-(--ds-muted)">
                {clientEnvError.NEXT_PUBLIC_API_URL.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}

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

              <ScrollArea
                viewportRef={listRef}
                className="flex-1 min-h-0 px-0 pb-4 pt-6"
              >
                <div className="space-y-8 pr-3">
                  {messages.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <ChatMessage
                        message={m}
                        showCursor={
                          m.role === "assistant" && m.id === streamingId
                        }
                      />
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
              </ScrollArea>

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
                      disabled={!canSend}
                    >
                      <PaperAirplaneIcon className="h-5 w-5 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </form>
                <p className="mt-2 text-xs leading-4 text-(--ds-muted)">
                  Chats may be logged.
                </p>
              </div>
            </section>

            <aside
              className={cn(
                "flex min-w-0 min-h-0 h-full flex-col md:border-l md:border-(--ds-border) md:pl-8 md:py-8",
                tab !== "sources" ? "hidden md:flex" : "block md:flex",
              )}
            >
              <div className="pt-6 md:pt-0">
                <div className="text-[17px] font-semibold leading-6">Sources</div>
                <div className="mt-3 h-px w-full bg-(--ds-border)" />
              </div>

              <ScrollArea className="mt-4 min-h-0 flex-1">
                <div className="space-y-4 pb-10 pr-3">
                  {sources.length === 0 ? (
                    <div className="text-sm text-center leading-6 text-(--ds-muted)">
                      Ask a question to see the retrieved sources.
                    </div>
                  ) : (
                    sources.map((s, index) => (
                      <SourceCard
                        key={`${s.filename}-${index}`}
                        source={s}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
