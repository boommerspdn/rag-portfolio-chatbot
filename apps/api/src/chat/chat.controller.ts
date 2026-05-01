import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const chatRequestSchema = z.object({
  message: z.string().min(1),
  history: z.array(chatHistoryMessageSchema).default([]),
  sessionId: z.string().min(1).optional(),
});

const sseDeltaSchema = z.object({
  delta: z.string(),
});

function parseAndAppendSseDeltas(params: {
  text: string;
  pending: string;
  appendFinal: (delta: string) => void;
}): string {
  const combined = params.pending + params.text;
  const events = combined.split('\n\n');
  const completeEvents = events.slice(0, -1);
  const nextPending = events.at(-1) ?? '';

  for (const event of completeEvents) {
    const lines = event.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice('data:'.length).trimStart();
      if (!data) continue;
      if (data === '[DONE]') continue;

      // Persist raw SSE exactly as received; parse deltas for finalText.
      try {
        const parsedJson: unknown = JSON.parse(data);
        const parsed = sseDeltaSchema.safeParse(parsedJson);
        if (parsed.success) {
          params.appendFinal(parsed.data.delta);
        }
      } catch {
        // ignore non-JSON data payloads
      }
    }
  }

  return nextPending;
}

function createSseTapTransform(params: {
  onRawChunk: (raw: string) => void;
  onDelta: (delta: string) => void;
}): Transform & { getPending: () => string } {
  const decoder = new TextDecoder();
  let pending = '';

  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const text = decoder.decode(chunk, { stream: true });
      params.onRawChunk(text);
      pending = parseAndAppendSseDeltas({
        text,
        pending,
        appendFinal: params.onDelta,
      });
      callback(null, chunk);
    },
    flush(callback) {
      const text = decoder.decode();
      if (text) {
        params.onRawChunk(text);
        pending = parseAndAppendSseDeltas({
          text,
          pending,
          appendFinal: params.onDelta,
        });
      }
      callback();
    },
  }) as Transform & { getPending: () => string };

  transform.getPending = () => pending;
  return transform;
}

@Controller('chat')
export class ChatController {
  public constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  public async chat(
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = chatRequestSchema.parse(body);
    const startedAt = Date.now();

    const requestId =
      (typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : undefined) ?? undefined;

    const log = await this.prisma.chatLog.create({
      data: {
        message: parsed.message,
        sessionId: parsed.sessionId ?? null,
        requestId,
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
        rawSse: '',
        finalText: '',
        status: 'stream_error',
      },
    });

    const abortController = new AbortController();
    let clientAborted = false;
    req.on('close', () => {
      if (!res.writableEnded) clientAborted = true;
      abortController.abort();
    });

    const upstreamResponse = await this.chatService.createUpstreamChatStream(
      {
        message: parsed.message,
        history: parsed.history,
        session_id: parsed.sessionId ?? null,
      },
      abortController.signal,
    );

    if (!upstreamResponse.ok) {
      const detail = await upstreamResponse.text().catch(() => '');
      await this.prisma.chatLog.update({
        where: { id: log.id },
        data: {
          status: 'upstream_error',
          upstreamStatus: upstreamResponse.status,
          errorDetail: detail,
          durationMs: Date.now() - startedAt,
        },
      });
      res.status(upstreamResponse.status).json({
        error: 'Upstream AI service error',
        detail,
      });
      return;
    }

    if (!upstreamResponse.body) {
      await this.prisma.chatLog.update({
        where: { id: log.id },
        data: {
          status: 'upstream_error',
          upstreamStatus: 502,
          errorDetail: 'Upstream AI service returned no body',
          durationMs: Date.now() - startedAt,
        },
      });
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

    let rawSse = '';
    let finalText = '';
    const tap = createSseTapTransform({
      onRawChunk: (chunk) => {
        rawSse += chunk;
      },
      onDelta: (delta) => {
        finalText += delta;
      },
    });

    try {
      await pipeline(readable, tap, res);
      await this.prisma.chatLog.update({
        where: { id: log.id },
        data: {
          rawSse,
          finalText,
          status: clientAborted ? 'aborted' : 'success',
          upstreamStatus: upstreamResponse.status,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      await this.prisma.chatLog.update({
        where: { id: log.id },
        data: {
          rawSse,
          finalText,
          status: clientAborted ? 'aborted' : 'stream_error',
          upstreamStatus: upstreamResponse.status,
          errorDetail: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        },
      });
      throw error;
    }
  }
}
