import fs from "node:fs";
import path from "node:path";
import { createPersistentContext, saveStorageState } from "./core/context";
import { log } from "./core/logger";
import { config } from "./config";
import { exampleTask } from "./modules/exampleTask";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  ensureDir(config.screenshotsDir);

  const context = await createPersistentContext();

  // In persistent context, there may already be a page open
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await exampleTask(page);

    // Save updated cookies/localstorage/session for next run
    await saveStorageState(context);
  } catch (err: any) {
    log.error(`Run failed: ${err?.message ?? err}`);

    const shot = path.join(config.screenshotsDir, `error-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    log.error(`Saved screenshot: ${shot}`);

    throw err;
  } finally {
    await context.close();
    log.info("Done.");
  }
}

main().catch((e) => {
  process.exitCode = 1;
});
