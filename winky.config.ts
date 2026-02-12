import type { WinkyConfig } from "./src/config/schema";

/**
 * Winky Configuration File
 *
 * This file contains all configuration for the Winky browser automation agent.
 * Sensitive values (API keys) should be stored in .env file.
 */
const config: WinkyConfig = {
  llm: {
    provider:
      (process.env.WINKY_LLM_PROVIDER as "openai" | "openrouter") || "openai",
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "",
    model: process.env.WINKY_LLM_MODEL || "gpt-4o",
    baseURL: process.env.WINKY_LLM_BASE_URL,
  },

  browser: {
    executablePath: process.env.WINKY_BROWSER_EXECUTABLE_PATH,
    headless: process.env.WINKY_BROWSER_HEADLESS === "true",
    defaultProfile: process.env.WINKY_BROWSER_PROFILE || "default",
    viewport: {
      width: parseInt(process.env.WINKY_BROWSER_VIEWPORT_WIDTH || "1280"),
      height: parseInt(process.env.WINKY_BROWSER_VIEWPORT_HEIGHT || "720"),
    },
  },

  logging: {
    level:
      (process.env.WINKY_LOG_LEVEL as "error" | "warn" | "info" | "debug") ||
      "info",
    retentionDays: parseInt(process.env.WINKY_LOG_RETENTION_DAYS || "7"),
  },

  acp: {
    enabled: process.env.WINKY_ACP_ENABLED === "true",
    agentName: process.env.WINKY_ACP_AGENT_NAME || "winky",
    agentTitle: process.env.WINKY_ACP_AGENT_TITLE || "Winky Browser Agent",
  },

  memory: {
    enabled: process.env.WINKY_MEMORY_ENABLED !== "false", // Default to true
    dbPath: process.env.WINKY_MEMORY_DB_PATH || "data/memory/winky.db",
  },
};

export default config;
