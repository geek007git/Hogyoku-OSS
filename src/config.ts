import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4173),
  APP_ORIGIN: z.string().url().default("http://localhost:4173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanString,
  SESSION_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().optional().default(""),
  CHAT_MODEL: z.string().default("gemini-2.5-flash-lite"),
  VISION_MODEL: z.string().default("gemini-2.5-flash-lite"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(40),
  LOG_LEVEL: z.string().default("info"),
});

export type AppConfig = z.infer<typeof schema>;

function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\n` +
      "Copy a preset (.env.free.example / .env.standard.example / .env.pro.example) " +
      "to .env and fill the values. See docs/TIERS.md and SETUP_REQUIRED.md.",
  );
}

function loadConfigOrExit(): AppConfig {
  try {
    return loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export const config = loadConfigOrExit();
export const isProduction = config.NODE_ENV === "production";
