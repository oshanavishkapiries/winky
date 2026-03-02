import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "../../core/context";
import { log } from "../../core/logger";
import { config } from "../../config";

import { extractLatestGmails } from "./gmail-latest-5";

export const moduleConfig = {
  name: "gmail-latest-5",
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

    const items = await extractLatestGmails(page, 5);

    const outDir = path.resolve(process.cwd(), "output", "gmail");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "latest-5.json");
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");

    log.info(`[${moduleConfig.name}] Latest 5 emails:`);
    for (const item of items) {
      const from = item.fromEmail ? `${item.from ?? ""} <${item.fromEmail}>` : item.from;
      log.info(
        `[${moduleConfig.name}] - ${item.timeTitle ?? ""} | ${from ?? ""} | ${item.subject ?? ""}`,
      );
    }
    log.info(`[${moduleConfig.name}] Wrote ${items.length} items -> ${outPath}`);

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
