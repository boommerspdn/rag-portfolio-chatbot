import { Injectable } from '@nestjs/common';
import { env } from '../env';

type ChatRole = 'user' | 'assistant';

interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

interface UpstreamChatBody {
  message: string;
  history: ChatHistoryMessage[];
  session_id: string | null;
}

@Injectable()
export class ChatService {
  public async createUpstreamChatStream(
    body: UpstreamChatBody,
    signal: AbortSignal,
  ): Promise<Response> {
    const url = new URL('/api/chat', env.AI_BASE_URL);
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });
  }
}
