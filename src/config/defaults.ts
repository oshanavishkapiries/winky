import type { WinkyConfig } from "./schema.js";

/**
 * Default configuration values
 * These are used as fallbacks when values are not provided in winky.config.ts
 */
export const defaultConfig: Partial<WinkyConfig> = {
  browser: {
    headless: false,
    defaultProfile: "default",
    viewport: {
      width: 1280,
      height: 720,
    },
  },

  logging: {
    level: "info",
    retentionDays: 7,
  },

  acp: {
    enabled: true,
    agentName: "winky",
    agentTitle: "Winky Browser Agent",
  },

  memory: {
    enabled: true,
    dbPath: "data/memory/winky.db",
  },
};
