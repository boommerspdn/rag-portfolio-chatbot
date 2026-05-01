import * as React from "react";
import { useState } from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

import { cn } from "../lib/cn";

export type SourceModel = {
  filename: string;
  score: number;
  content: string;
};

function formatScore(score: number) {
  const normalized = Number.isFinite(score) ? score : 0;
  return normalized.toFixed(2);
}

function ChevronIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
      {...rest}
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l, idx, arr) => !(idx === arr.length - 1 && l.trim() === ""));
}

export interface SourceCardProps
  extends React.ComponentPropsWithoutRef<"div"> {
  source: SourceModel;
}

export function SourceCard({ source, className, ...props }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = toLines(source.content);
  const visibleLines = expanded ? lines : lines.slice(0, 5);
  const endLine = Math.max(1, visibleLines.length);

  return (
    <div
      className={cn(
        "rounded-[10px] border border-(--ds-border) bg-(--ds-panel)",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-(--ds-muted)" aria-hidden="true" />
          <span className="min-w-0 truncate text-sm font-medium text-(--ds-text)">
            {source.filename}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-(--ds-accent-soft) px-2 py-0.5 text-xs font-semibold text-(--ds-accent)">
            {formatScore(source.score)}
          </span>
          <ChevronIcon
            className={cn(
              "text-(--ds-muted) transition-transform",
              expanded ? "rotate-180" : "rotate-0",
            )}
          />
        </div>
      </button>

      <div className="px-4 pb-4">
        <div className="rounded-[10px] border border-(--ds-border) bg-(--ds-panel-2) px-3 py-2">
          <div className="grid grid-cols-[2.25rem_1fr] gap-x-3 font-mono text-[12.5px] leading-5 text-(--ds-text)">
            {visibleLines.map((line, idx) => (
              <React.Fragment key={`${idx}-${line}`}>
                <div className="select-none text-right text-(--ds-muted)">
                  {idx + 1}
                </div>
                <div className="min-w-0 whitespace-pre-wrap wrap-break-word">
                  {line.length === 0 ? " " : line}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-(--ds-muted)">
          <span>{`Chunk 1  •  Lines 1-${endLine}`}</span>
          <span className="text-(--ds-accent)">
            {expanded ? "Show less" : "Show more"}
          </span>
        </div>
      </div>
    </div>
  );
}

