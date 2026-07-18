import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  STATEMENT_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(2_000_000),
  GOOGLE_GENAI_API_KEY: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional()
});

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (rawEnv: NodeJS.ProcessEnv = process.env): AppConfig =>
  envSchema.parse(rawEnv);
