import { z } from 'zod';

const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().positive().optional()),
  DATABASE_URL: z.string().min(1).pipe(z.string().url()),
  AI_BASE_URL: z
    .string()
    .optional()
    .transform((value) => value ?? 'http://ai:8000')
    .pipe(z.string().url()),
  WEB_ORIGIN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
