# System Architecture & LLM Context Guide

This document is written as a strict system prompt and architecture guide for any Large Language Model (LLM) or developer contributing to this codebase. It defines how the automation orchestrator works, the design philosophy, and the exact steps required to implement a new scraping module.

## Core Design Philosophy

1. **Unified Global Playwright Profile**: All modules and automated scripts share ONE single browser profile and storage state (cookies/sessions). These paths are defined globally in `src/config.ts`. You must NEVER create local isolated `./profiles` inside a module.
2. **Native Playwright MCP Server**: An external AI can steer this project's fully authenticated profile dynamically. You can boot `npm run dev` and select "Start AI MCP Server" to launch a standard Model Context Protocol stdio server to investigate targets.
3. **Zero `.env` or Cron**: The project does NOT use `dotenv` or `node-cron`. Global configurations are hardcoded centrally inside `src/config.ts`.
4. **Dynamic Discovery**: The master Node.js daemon acts as a dynamic module loader. It scans `src/modules/` and automatically binds recognized modules to the TUI (Terminal Interface) and the REST API.

---

## Directory Structure Overview

```text
/src
  /config.ts         # Master global configuration (DB URL, Global Profile paths)
  /core
    /context.ts      # Instantiates Playwright using context options
    /mcp-server.ts   # Model Context Protocol stdio server exposing Playwright to AIs
    /db.ts           # Centralized PostgreSQL connection pooling
    /server.ts       # Express REST API
    /logger.ts       # Centralized Winston/Console logger
  /modules
    /{module-name}/  # Dedicated module folder
      index.ts       # The mandatory entry point exposing standard interfaces
```

---

## How to Create a New Module

When requested to create a new scraping module, the LLM MUST follow the architecture steps below.

### 1. Folder Setup

Always create a new dedicated folder inside `src/modules/`, for example `src/modules/linkedin-scraper/`. All scripts, types, repository files, and SQL schemas for this specific task must live inside this folder.

### 2. The `index.ts` Standard Interface

For the TUI and Express API to dynamically recognize and trigger the module, the module folder **MUST** contain an `index.ts` file that precisely implements the following template:

```typescript
import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "../../core/context";
import { log } from "../../core/logger";
import { config } from "../../config";

// 1. Module Configuration (Mandatory)
export const moduleConfig = {
  name: "your-module-name-here", // Used for API routes and TUI lists
};

// 2. Active State Tracking (Mandatory)
let _isRunning = false;

export function isRunning() {
  return _isRunning;
}

// 3. Main Execution Function (Mandatory)
export async function run() {
  if (_isRunning) {
    log.warn(
      `[${moduleConfig.name}] Previous task is still running. Skipping.`,
    );
    return;
  }
  _isRunning = true;
  let context;

  try {
    log.info(
      `[${moduleConfig.name}] Starting execution using global profile...`,
    );

    // Boot using shared global Playwright profiles
    context = await createPersistentContext({
      profileDir: config.profileDir,
      storageStatePath: config.storageStatePath,
    });

    const page =
      context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // --- EXECUTE CUSTOM LOGIC HERE ---
    // await page.goto("https://target-site.com");
    // ---------------------------------

    // Save session cookies back to the global unified state
    await saveStorageState(context, config.storageStatePath);
    log.info(`[${moduleConfig.name}] Execution finished successfully.`);
  } catch (error) {
    log.error(`[${moduleConfig.name}] Critical execution error: ${error}`);
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    _isRunning = false;
  }
}

// 4. Standalone Execution Support
if (require.main === module) {
  run().then(() => process.exit(0));
}
```

### 3. AI-Driven Module Creation using the MCP

If you are an AI assistant trying to build a scraping script for this project:

1. Connect to the `winky-playwright-mcp` stdio server.
2. Use `winky_navigate` to visit the target URL. You will inherit the user's cookies automatically because the MCP uses the exact same `config.profileDir` as the core executing logic.
3. Use `winky_get_html` and `winky_evaluate` to identify the right Playwright selectors.
4. Once you figure out the page structure, write the logic into the new module folder following the template above!
