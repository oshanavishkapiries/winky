import type { WinkyConfig } from "./src/config/schema";

/**
 * Winky Configuration File
 *
 * This file contains all configuration for the Winky browser automation agent.
 * Copy this file and customize it for your needs.
 */
const config: WinkyConfig = {
  llm: {
    provider: "openrouter", // or 'openai'
    apiKey: process.env.OPENAI_API_KEY || "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",
    model: "arcee-ai/trinity-large-preview:free", // or any OpenAI/OpenRouter model
    baseURL: "https://openrouter.ai/api/v1", // Uncomment for OpenRouter
  },

  browser: {
    // Path to your browser executable
    // Windows: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    // macOS: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    // Linux: '/usr/bin/google-chrome'
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

    headless: false, // Set to true for headless mode
    defaultProfile: "default", // Browser profile name

    viewport: {
      width: 1280,
      height: 720,
    },
  },

  logging: {
    level: "info", // 'error' | 'warn' | 'info' | 'debug'
    retentionDays: 7, // How long to keep logs
  },

  acp: {
    enabled: true, // Enable ACP server for editor integration
    agentName: "winky",
    agentTitle: "Winky Browser Agent",
  },
};

export default config;
