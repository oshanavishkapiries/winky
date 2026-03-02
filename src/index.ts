import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { log } from "./core/logger";
import * as cron from "node-cron";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

// Ensure basic output folders
ensureDir(config.downloadsDir);
ensureDir(config.screenshotsDir);

// -----------------------------------------------------
// BOOTSTRAP / SCHEDULER
// -----------------------------------------------------

log.info("====================================");
log.info(`Winky Scraper Master Scheduler`);
log.info("====================================");

async function loadModules() {
  if (!config.enableScheduler) {
    log.info(
      "[Scheduler] Scheduler is currently disabled via config (ENABLE_SCHEDULER). Exiting master loop.",
    );
    return;
  }

  const modulesPath = path.join(__dirname, "modules");
  const directories = fs
    .readdirSync(modulesPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  let loadedModules = 0;

  for (const dirName of directories) {
    const moduleIndexPath = path.join(modulesPath, dirName, "index.ts");

    // Only attempt to load isolated encapsulated modules if they expose an index.ts
    // (Ignores template directories if they don't have an index.ts)
    if (fs.existsSync(moduleIndexPath)) {
      try {
        const mod = require(moduleIndexPath);
        if (mod.moduleConfig && mod.run) {
          const scheduleStr = mod.moduleConfig.schedule;

          if (!cron.validate(scheduleStr)) {
            log.error(
              `[Loader] Module '${mod.moduleConfig.name}' has invalid cron string: ${scheduleStr}`,
            );
            continue;
          }

          cron.schedule(scheduleStr, () => {
            log.info(`[Scheduler] Triggering module: ${mod.moduleConfig.name}`);
            mod.run();
          });

          log.info(
            `[Loader] Successfully bound module '${mod.moduleConfig.name}' (Cron: ${scheduleStr})`,
          );
          loadedModules++;
        }
      } catch (e) {
        log.warn(`[Loader] Failed to load module inside ${dirName}: ${e}`);
      }
    }
  }

  log.info(
    `[Loader] Finished. Successfully bound scheduling to ${loadedModules} active module(s).`,
  );
}

// Boot the Master Loop
loadModules();

// Graceful Shutdown Handlers
process.on("SIGINT", () => {
  log.info("Received SIGINT. Shutting down gracefully...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log.info("Received SIGTERM. Shutting down gracefully...");
  process.exit(0);
});
