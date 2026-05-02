type ChatMessageRole = "user" | "assistant";

export type ChatMessageModel = {
  role: ChatMessageRole;
  content: string;
};

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "../lib/cn";

export interface ChatMessageProps
  extends React.ComponentPropsWithoutRef<"div"> {
  message: ChatMessageModel;
  showCursor?: boolean;
}

export function ChatMessage({
  message,
  showCursor = false,
  className,
  ...props
}: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className={cn("flex justify-end", className)} {...props}>
        <div className="max-w-[85%] rounded-full bg-(--ds-user-bubble) px-4 py-2 text-[15px] leading-relaxed text-(--ds-text)">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex justify-start", className)} {...props}>
      <div className="sm:max-w-[85%] border-l-2 border-(--ds-accent) pl-3 text-[15px] leading-relaxed text-(--ds-text)">
        <div className="chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {showCursor ? (
          <span className="inline-block w-[0.5ch] align-baseline">
            <span className="inline-flex -translate-y-px items-center gap-1 align-baseline">
              <span className="inline-block size-2 animate-pulse rounded-full bg-(--ds-accent) [animation-delay:-0.3s] [animation-duration:0.9s]" />
              <span className="inline-block size-2 animate-pulse rounded-full bg-(--ds-accent) [animation-delay:-0.15s] [animation-duration:0.9s]" />
              <span className="inline-block size-2 animate-pulse rounded-full bg-(--ds-accent) [animation-duration:0.9s]" />
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

