import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "../../core/context";
import { log } from "../../core/logger";
import { config } from "../../config";

import { run4kWallpapersDownload } from "./runner";

export const moduleConfig = {
  name: "4kwallpapers-download-images",
};

let _isRunning = false;

export function isRunning() {
  return _isRunning;
}

export async function run() {
  if (_isRunning) {
    log.warn(
      `[${moduleConfig.name}] Previous API task is still running. Skipping trigger.`,
    );
    return;
  }

  _isRunning = true;
  let context;

  try {
    log.info(`[${moduleConfig.name}] Starting execution using global profile...`);

    context = await createPersistentContext({
      profileDir: config.profileDir,
      storageStatePath: config.storageStatePath,
    });

    const page = context.pages()[0] ?? (await context.newPage());

    const outDir = path.resolve(process.cwd(), config.downloadsDir, "4kwallpapers");
    fs.mkdirSync(outDir, { recursive: true });

    await run4kWallpapersDownload(page, {
      baseUrl: "https://4kwallpapers.com/",
      outputDir: outDir,
    });

    await saveStorageState(context, config.storageStatePath);
    log.info(`[${moduleConfig.name}] Execution finished successfully.`);
  } catch (error) {
    log.error(`[${moduleConfig.name}] Critical error during execution: ${error}`);
  } finally {
    if (context) {
      log.info(`[${moduleConfig.name}] Closing local browser context...`);
      await context.close().catch(() => {});
    }
    _isRunning = false;
  }
}

if (require.main === module) {
  log.info(`[${moduleConfig.name}] Initiating independent manual run...`);
  run().then(() => {
    log.info(`[${moduleConfig.name}] Manual run fully resolved.`);
    process.exit(0);
  });
}
