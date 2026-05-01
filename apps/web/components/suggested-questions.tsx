import * as React from "react";

import { cn } from "../lib/cn";

export interface SuggestedQuestionsProps
  extends React.ComponentPropsWithoutRef<"div"> {
  questions: string[];
  visible: boolean;
  onPick: (question: string) => void;
}

export function SuggestedQuestions({
  questions,
  visible,
  onPick,
  className,
  ...props
}: SuggestedQuestionsProps) {
  if (!visible) return null;

  return (
    <div className={cn("pb-6", className)} {...props}>
      <div className="mb-2 text-xs font-medium leading-relaxed text-(--ds-muted)">
        Suggested questions
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-(--ds-border) bg-(--ds-panel) px-3 py-1.5 text-sm text-(--ds-text) hover:bg-(--ds-hover)"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

