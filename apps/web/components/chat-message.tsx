type ChatMessageRole = "user" | "assistant";

export type ChatMessageModel = {
  role: ChatMessageRole;
  content: string;
};

import * as React from "react";

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
      <div className="max-w-[85%] border-l-2 border-(--ds-accent) pl-3 text-[15px] leading-relaxed text-(--ds-text)">
        <span className="whitespace-pre-wrap">{message.content}</span>
        {showCursor ? (
          <span className="inline-block w-[0.5ch] align-baseline">
            <span className="inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse bg-(--ds-accent)" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

