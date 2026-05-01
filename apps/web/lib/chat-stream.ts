import { z } from "zod";

import { clientEnv } from "./env";

export const sourceSchema = z.object({
  filename: z.string(),
  score: z.coerce.number(),
  content: z.string(),
});

const sourcesEventSchema = z.object({ sources: z.array(sourceSchema) });
const deltaEventSchema = z.object({ delta: z.string() });

export type SourcePayload = z.infer<typeof sourceSchema>;

export interface ChatStreamHandlers {
  onSources: (sources: SourcePayload[]) => void;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function parseSseDataLines(frame: string): string[] {
  const lines = frame.split("\n");
  const payloads: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const value = line.slice(5).trimStart();
      payloads.push(value);
    }
  }
  return payloads;
}

export async function streamChat(
  message: string,
  history: ChatHistoryMessage[],
  handlers: ChatStreamHandlers,
): Promise<void> {
  const base = clientEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({ message, history }),
    signal: handlers.signal,
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}).`);
  }

  const body = res.body;
  if (!body) {
    throw new Error("Response had no body.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      for (const payload of parseSseDataLines(frame)) {
        if (payload === "[DONE]") {
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload) as unknown;
        } catch {
          continue;
        }

        const sourcesParsed = sourcesEventSchema.safeParse(parsed);
        if (sourcesParsed.success) {
          handlers.onSources(sourcesParsed.data.sources);
          continue;
        }

        const deltaParsed = deltaEventSchema.safeParse(parsed);
        if (deltaParsed.success) {
          handlers.onDelta(deltaParsed.data.delta);
        }
      }
    }
  }
}
