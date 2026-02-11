import { z } from "zod";

/**
 * Zod schema for Winky configuration
 * Provides runtime type safety and validation
 */
export const WinkyConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["openai", "openrouter"]),
    apiKey: z.string().min(1, "LLM API key is required"),
    model: z.string().min(1, "LLM model name is required"),
    baseURL: z.string().url().optional(), // For OpenRouter or custom endpoints
  }),

  browser: z.object({
    executablePath: z
      .string()
      .optional()
      .describe(
        "Path to browser executable. Leave empty to use Playwright's bundled Chromium.",
      ),
    headless: z.boolean().default(false),
    defaultProfile: z.string().default("default"),
    viewport: z
      .object({
        width: z.number().int().positive().default(1280),
        height: z.number().int().positive().default(720),
      })
      .optional(),
  }),

  logging: z.object({
    level: z.enum(["error", "warn", "info", "debug"]).default("info"),
    retentionDays: z.number().int().positive().default(7),
  }),

  acp: z.object({
    enabled: z.boolean().default(true),
    agentName: z.string().default("winky"),
    agentTitle: z.string().default("Winky Browser Agent"),
  }),

  memory: z.object({
    enabled: z.boolean().default(true),
    dbPath: z.string().default("data/memory/winky.db"),
  }),
});

export type WinkyConfig = z.infer<typeof WinkyConfigSchema>;
