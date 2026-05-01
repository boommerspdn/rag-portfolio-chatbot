import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_MODEL_LABEL: z.string().default("Sonnet 4.6"),
});

const clientEnvParsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_MODEL_LABEL: process.env.NEXT_PUBLIC_MODEL_LABEL,
});

export const clientEnv = clientEnvParsed.success
  ? clientEnvParsed.data
  : {
      NEXT_PUBLIC_API_URL: "",
      NEXT_PUBLIC_MODEL_LABEL:
        process.env.NEXT_PUBLIC_MODEL_LABEL ?? "Sonnet 4.6",
    };

export const clientEnvError = clientEnvParsed.success
  ? null
  : clientEnvParsed.error.flatten().fieldErrors;
