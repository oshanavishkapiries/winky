import { loadConfig } from "./config/index.js";
import { getLogger } from "./logger/Logger.js";
import { BrowserManager } from "./browser/BrowserManager.js";
import { PageManager } from "./browser/PageManager.js";
import { ProfileManager } from "./browser/ProfileManager.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { LLMService } from "./llm/LLMService.js";
import { Orchestrator } from "./agent/Orchestrator.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * Winky - Browser Automation Agent
 * Entry point for both CLI and ACP server modes
 */
async function main() {
  const logger = getLogger();
  let browserManager: BrowserManager | null = null;
  let orchestrator: Orchestrator | null = null;

  try {
    // Load and validate configuration
    const config = await loadConfig();
    logger.workflow("info", "Winky starting...", {
      config: {
        llmProvider: config.llm.provider,
        browserHeadless: config.browser.headless,
        acpEnabled: config.acp.enabled,
      },
    });

    // Initialize browser manager
    browserManager = new BrowserManager(config.browser);
    const profileManager = new ProfileManager();

    // Launch browser with profile
    const profilePath = profileManager.createProfile(
      config.browser.defaultProfile,
    );
    await browserManager.launchPersistent(profilePath);
    logger.workflow("info", "Browser launched");

    // Initialize page manager
    const context = browserManager.getContext();
    const pageManager = new PageManager(context);

    // Initialize tool registry
    const toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    logger.workflow("info", `Loaded ${toolRegistry.getToolCount()} tools`);

    // Initialize LLM service
    const llmService = new LLMService(config.llm);
    logger.workflow("info", "LLM service initialized");

    // Initialize orchestrator
    orchestrator = new Orchestrator(llmService.getProvider(), toolRegistry, {
      browserManager,
      pageManager,
    });
    logger.workflow("info", "Orchestrator initialized");

    console.log("\n🌟 Winky Browser Agent Ready!\n");
    console.log(`📊 Loaded ${toolRegistry.getToolCount()} tools`);
    console.log(`🤖 LLM: ${config.llm.provider} (${config.llm.model})`);
    console.log(
      `🌐 Browser: ${config.browser.headless ? "Headless" : "Headed"}\n`,
    );

    // Start interactive CLI
    const rl = readline.createInterface({ input, output });

    while (true) {
      const userInput = await rl.question("You: ");

      if (!userInput.trim()) continue;

      if (
        userInput.toLowerCase() === "exit" ||
        userInput.toLowerCase() === "quit"
      ) {
        console.log("\n👋 Goodbye!\n");
        rl.close();
        break;
      }

      if (userInput.toLowerCase() === "reset") {
        orchestrator.reset();
        console.log("\n🔄 Conversation reset\n");
        continue;
      }

      try {
        await orchestrator.executeTask(userInput);
      } catch (error) {
        console.error(
          "\n❌ Error:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (browserManager) {
      await browserManager.close();
    }
    if (orchestrator) {
      const logger = getLogger();
      await logger.close();
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\nShutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\nShutting down gracefully...");
  process.exit(0);
});

main();
