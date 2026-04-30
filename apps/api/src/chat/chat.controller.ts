import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { z } from 'zod';
import { ChatService } from './chat.service';

const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});

@Controller('chat')
export class ChatController {
  public constructor(private readonly chatService: ChatService) {}

  @Post()
  public async chat(
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = chatRequestSchema.parse(body);

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const upstreamResponse = await this.chatService.createUpstreamChatStream(
      { message: parsed.message, session_id: parsed.sessionId ?? null },
      abortController.signal,
    );

    if (!upstreamResponse.ok) {
      const detail = await upstreamResponse.text().catch(() => '');
      res.status(upstreamResponse.status).json({
        error: 'Upstream AI service error',
        detail,
      });
      return;
    }

    if (!upstreamResponse.body) {
      res.status(502).json({ error: 'Upstream AI service returned no body' });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const bodyStream =
      upstreamResponse.body as unknown as NodeReadableStream<Uint8Array>;
    const readable = Readable.fromWeb(bodyStream);
    await pipeline(readable, res);
  }
}

