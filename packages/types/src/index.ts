// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatChunk {
  delta: string;
  done?: boolean;
}

// ─── API error envelope ───────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
