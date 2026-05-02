import { HomeIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-(--ds-bg) px-5 py-16 text-(--ds-text)">
      <div className="w-full max-w-[420px] text-center">
        <p className="font-mono text-sm font-medium tabular-nums text-(--ds-accent)">
          404
        </p>
        <h1 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[32px]">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-(--ds-muted)">
          This URL does not match anything on the site. You can head back to the
          portfolio chat and keep exploring.
        </p>

        <div className="mt-8 rounded-[12px] border border-(--ds-border) bg-(--ds-panel) px-4 py-4 text-left text-sm leading-6 text-(--ds-muted)">
          <span className="font-medium text-(--ds-text)">Sapondanai Thongchua</span>
          <span className="mx-1.5 text-(--ds-border)">·</span>
          RAG portfolio chatbot
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-[10px] bg-(--ds-accent) px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ds-accent)"
        >
          <HomeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          Return home
        </Link>
      </div>
    </div>
  );
}
