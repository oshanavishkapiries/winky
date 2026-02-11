import type { WinkyConfig } from "./src/config/schema";

/**
 * Winky Configuration File
 *
 * This file contains all configuration for the Winky browser automation agent.
 * Copy this file and customize it for your needs.
 */
const config: WinkyConfig = {
  llm: {
    provider: "openai", // or 'openai , openrouter'
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4o", // or any OpenAI model
    // model: "arcee-ai/trinity-large-preview:free", // or any OpenAI/OpenRouter model
    // baseURL: "https://openrouter.ai/api/v1", // Uncomment for OpenRouter
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
    enabled: false, // Enable ACP server for editor integration
    agentName: "winky",
    agentTitle: "Winky Browser Agent",
  },

  memory: {
    enabled: true, // Enable persistent memory
    dbPath: "data/memory/winky.db",
  },
};

export default config;
