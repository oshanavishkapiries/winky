import fs from "node:fs";
import { createPersistentContext, saveStorageState } from "./core/context";
import { config } from "./config";
import { log } from "./core/logger";
import * as cron from "node-cron";

// scripts
import { googleMapsDataExtract } from "./modules/google-maps-extract/google-maps-data-extract";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

// Ensure basic output folders
ensureDir(config.downloadsDir);
ensureDir(config.screenshotsDir);

let isTaskRunning = false;

async function runScrapingTask() {
  if (isTaskRunning) {
    log.warn(
      "A previous scraping task is still running. Skipping this cron tick.",
    );
    return;
  }
  isTaskRunning = true;
  let context;

  try {
    log.info("Starting scheduled Playwright scraping task...");

    context = await createPersistentContext();
    const page = context.pages()[0] ?? (await context.newPage());

    // Execute Modules Here
    await googleMapsDataExtract(page);

    // Save updated cookies/localstorage/session for next run
    await saveStorageState(context);

    log.info("Scheduled scraping task finished successfully.");
  } catch (error) {
    log.error(`Critical error during scheduled task execution: ${error}`);
  } finally {
    if (context) {
      log.info("Closing browser context...");
      await context.close().catch(() => {});
    }
    isTaskRunning = false;
  }
}

// -----------------------------------------------------
// BOOTSTRAP / SCHEDULER
// -----------------------------------------------------

log.info("====================================");
log.info(`Winky Scraper Scheduler Started`);
log.info(`Cron Expression: ${config.cronSchedule}`);
log.info("====================================");

// Validate Cron
if (!cron.validate(config.cronSchedule)) {
  log.error(
    `Invalid cron expression defined in config: ${config.cronSchedule}`,
  );
  process.exit(1);
}

// Schedule the Job
cron.schedule(config.cronSchedule, () => {
  log.info(`Cron triggered at ${new Date().toISOString()}`);
  runScrapingTask();
});

// Graceful Shutdown Handlers
process.on("SIGINT", () => {
  log.info("Received SIGINT. Shutting down gracefully...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log.info("Received SIGTERM. Shutting down gracefully...");
  process.exit(0);
});
