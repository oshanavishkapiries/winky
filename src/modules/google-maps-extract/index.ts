import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "../../core/context";
import { log } from "../../core/logger";

// Main extractor logic
import { googleMapsDataExtract } from "./google-maps-data-extract";

// Encapsulated Module Configuration
export const moduleConfig = {
  name: "google-maps-extract",
  schedule: process.env.CRON_GOOGLE_MAPS ?? "0 0 * * *", // Default run at midnight

  // Localized directories ensuring no session cross-contamination
  profileDir: path.resolve(__dirname, "./profiles/default"),
  storageStatePath: path.resolve(__dirname, "./storage/state.json"),
};

let isRunning = false;

/**
 * Encapsulated execution script for this module alone.
 * It strictly uses the local profile and local storage.
 */
export async function run() {
  if (isRunning) {
    log.warn(
      `[${moduleConfig.name}] Previous scheduled task is still running. Skipping tick.`,
    );
    return;
  }
  isRunning = true;
  let context;

  try {
    log.info(`[${moduleConfig.name}] Starting encapsulated execution...`);

    // Boot using local profiles
    context = await createPersistentContext({
      profileDir: moduleConfig.profileDir,
      storageStatePath: moduleConfig.storageStatePath,
    });

    const page = context.pages()[0] ?? (await context.newPage());

    // Execute core logic
    await googleMapsDataExtract(page);

    // Save state back to local storage
    await saveStorageState(context, moduleConfig.storageStatePath);

    log.info(`[${moduleConfig.name}] Execution finished successfully.`);
  } catch (error) {
    log.error(
      `[${moduleConfig.name}] Critical error during execution: ${error}`,
    );
  } finally {
    if (context) {
      log.info(`[${moduleConfig.name}] Closing local browser context...`);
      await context.close().catch(() => {});
    }
    isRunning = false;
  }
}

// Support Independent Execution via `npm run module:google-maps-extract`
if (require.main === module) {
  log.info(`[${moduleConfig.name}] Initiating independent manual run...`);
  run().then(() => {
    log.info(`[${moduleConfig.name}] Manual run fully resolved.`);
    process.exit(0);
  });
}
