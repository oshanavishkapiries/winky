import { loadConfig } from "./config/index.js";
import { getLogger } from "./logger/Logger.js";

/**
 * Winky - Browser Automation Agent
 * Entry point for both CLI and ACP server modes
 */
async function main() {
  try {
    // Load and validate configuration
    const config = await loadConfig();
    const logger = getLogger(config.logging.level);

    logger.workflow("info", "Winky starting...", {
      config: {
        llmProvider: config.llm.provider,
        browserHeadless: config.browser.headless,
        acpEnabled: config.acp.enabled,
      },
    });

    // TODO: Initialize browser manager
    // TODO: Initialize tool registry
    // TODO: Initialize LLM service
    // TODO: Initialize orchestrator
    // TODO: Start ACP server or CLI mode

    logger.workflow("info", "Winky initialized successfully");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  const logger = getLogger();
  await logger.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  const logger = getLogger();
  await logger.close();
  process.exit(0);
});

main();
