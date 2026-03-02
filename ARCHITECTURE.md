# System Architecture & LLM Context Guide

This document is written as a strict system prompt and architecture guide for any Large Language Model (LLM) or developer contributing to this codebase. It defines how the automation orchestrator works, the design philosophy, and the exact steps required to implement a new scraping module.

## Core Design Philosophy

1. **Strict Data Encapsulation**: Every scraping script must be 100% physically isolated from other scripts. Browser profiles, cookies, and local session states MUST run inside the module's localized directory.
2. **Zero `.env` or Cron**: The project does NOT use `dotenv` or `node-cron`. Global configurations are hardcoded centrally inside `src/config.ts`. Schedules are handled by external orchestrators hitting the API.
3. **Dynamic Discovery**: The master Node.js daemon acts as a dynamic module loader. It scans `src/modules/` and automatically binds recognized modules to the TUI (Terminal Interface) and the REST API.
4. **Common Core, Custom Modules**: All generic database connections, Playwright bootstraps, and HTTP APIs live in `src/core/`. Unique business logic, types, and database queries live strictly in `src/modules/{module-name}/`.

---

## Directory Structure Overview

```text
/src
  /config.ts         # Master global configuration (DB URL, common directories, Ports)
  /core
    /context.ts      # Instantiates Playwright using context options passed by the module
    /db.ts           # Centralized PostgreSQL connection pooling
    /server.ts       # Express REST API
    /logger.ts       # Centralized Winston/Console logger
  /modules
    /{module-name}/  # Fully isolated module folder
      index.ts       # The mandatory entry point exposing standard interfaces
      profiles/      # (Auto-generated) Local Playwright fingerprint & profile cache
      storage/       # (Auto-generated) Local state.json containing auth cookies
```

---

## How to Create a New Module

When requested to create a new scraping module, the LLM MUST follow the architecture steps below.

### 1. Folder Setup

Always create a new dedicated folder inside `src/modules/`, for example `src/modules/instagram-scraper/`. All scripts, types, repository files, and SQL schemas for this specific task must live inside this folder.

### 2. The `index.ts` Standard Interface

For the TUI and Express API to dynamically recognize and trigger the module, the module folder **MUST** contain an `index.ts` file that precisely implements the following template:

```typescript
import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "../../core/context";
import { log } from "../../core/logger";

// Import your custom module logic
// import { yourScrapingLogic } from "./scraper";

// 1. Module Configuration (Mandatory)
export const moduleConfig = {
  name: "your-module-name-here", // Used for API routes and TUI lists
  profileDir: path.resolve(__dirname, "./profiles/default"),
  storageStatePath: path.resolve(__dirname, "./storage/state.json"),
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
      `[${moduleConfig.name}] Previous API task is still running. Skipping.`,
    );
    return;
  }
  _isRunning = true;
  let context;

  try {
    log.info(`[${moduleConfig.name}] Starting encapsulated execution...`);

    // Boot using LOCAL module-specific profiles
    context = await createPersistentContext({
      profileDir: moduleConfig.profileDir,
      storageStatePath: moduleConfig.storageStatePath,
    });

    const page = context.pages()[0] ?? (await context.newPage());

    // --- EXECUTE CUSTOM LOGIC HERE ---
    // await yourScrapingLogic(page);
    // ---------------------------------

    // Save session state to the local isolated storage
    await saveStorageState(context, moduleConfig.storageStatePath);
    log.info(`[${moduleConfig.name}] Execution finished successfully.`);
  } catch (error) {
    log.error(`[${moduleConfig.name}] Critical execution error: ${error}`);
  } finally {
    if (context) {
      log.info(`[${moduleConfig.name}] Closing local browser context...`);
      await context.close().catch(() => {});
    }
    _isRunning = false;
  }
}

// 4. Standalone Execution Support
if (require.main === module) {
  log.info(`[${moduleConfig.name}] Initiating independent manual run...`);
  run().then(() => {
    log.info(`[${moduleConfig.name}] Manual run fully resolved.`);
    process.exit(0);
  });
}
```

### 3. Execution Integration

You DO NOT need to touch `src/index.ts` or `src/core/server.ts` to register the new module!
Once `index.ts` is saved, the dynamic scanner will automatically expose it to the `prompts` CLI Menu and mount it to `POST /api/modules/your-module-name-here/start`.

### 4. Database Interactions

If the module requires database tracking (like deduplication), the LLM must:

- Write a `schema.sql` file inside the module folder.
- Write a `repository.ts` file inside the module folder using `import { db } from "../../core/db";`.
- Inject the repository methods into the core scraping logic file.
