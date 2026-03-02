import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { log } from "./core/logger";
import { startApiServer } from "./core/server";

// -----------------------------------------------------
// Bootloader & Module Discovery
// -----------------------------------------------------

function getAvailableModules() {
  const modulesPath = path.resolve(__dirname, "modules");
  if (!fs.existsSync(modulesPath)) return [];

  const directories = fs
    .readdirSync(modulesPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const modules: Record<string, any> = {};

  for (const dirName of directories) {
    const moduleIndexPath = path.join(modulesPath, dirName, "index.ts");
    if (fs.existsSync(moduleIndexPath)) {
      try {
        const mod = require(moduleIndexPath);
        if (mod.moduleConfig && mod.run) {
          modules[mod.moduleConfig.name] = mod;
        }
      } catch (e) {
        log.warn(`[TUI] Failed to load module inside ${dirName}: ${e}`);
      }
    }
  }

  return modules;
}

// -----------------------------------------------------
// Interactive Command Line Interface (TUI)
// -----------------------------------------------------

async function showInteractiveMenu() {
  log.info("====================================");
  log.info(`Winky Scraper Master CLI`);
  log.info("====================================");

  const modules = getAvailableModules();
  const moduleNames = Object.keys(modules);

  const response = await prompts({
    type: "select",
    name: "action",
    message: "What would you like to do?",
    choices: [
      { title: "Run a specific module natively", value: "run_module" },
      {
        title: "Start REST API Server",
        value: "start_api",
        description: "Boot the Express HTTP Server to remotely control modules",
      },
      {
        title: "Start AI MCP Server (StdIO)",
        value: "start_mcp",
        description: "Exposes Playwright stealth profile to external LLMs",
      },
      { title: "Exit", value: "exit" },
    ],
  });

  if (response.action === "run_module") {
    if (moduleNames.length === 0) {
      log.warn("No active modules found in /src/modules.");
      return process.exit(0);
    }

    const modResponse = await prompts({
      type: "select",
      name: "target",
      message: "Select a module to execute:",
      choices: moduleNames.map((name) => ({ title: name, value: name })),
    });

    if (modResponse.target) {
      const targetName = modResponse.target as string;
      const targetModule = (modules as Record<string, any>)[targetName];
      log.info(`[TUI] Initiating native execution of: ${targetName}`);

      try {
        await targetModule.run();
        log.info(`[TUI] Finished native execution of: ${modResponse.target}`);
      } catch (e) {
        log.error(`[TUI] Native execution error: ${e}`);
      }
    }

    // Recursive loop back to the main menu
    console.log("\n");
    await showInteractiveMenu();
  } else if (response.action === "start_api") {
    startApiServer();
    // Do not loop, keep process listening infinitely
  } else if (response.action === "start_mcp") {
    log.info("Booting MCP Protocol on StdIO...");
    // We launch it via ts-node directly taking over the current process's stdio
    // shell: true is critical for Windows to resolve 'npx.cmd'
    require("child_process").spawn(
      "npx",
      ["ts-node", path.resolve(__dirname, "./core/mcp-server.ts")],
      { stdio: "inherit", shell: true },
    );
  } else {
    log.info("Goodbye!");
    process.exit(0);
  }
}

// Boot
showInteractiveMenu().catch((err) => {
  log.error(`Fatal TUI Error: ${err}`);
  process.exit(1);
});

// Graceful Shutdown Handlers
process.on("SIGINT", () => {
  log.info("\nReceived SIGINT. Shutting down gracefully...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log.info("\nReceived SIGTERM. Shutting down gracefully...");
  process.exit(0);
});
