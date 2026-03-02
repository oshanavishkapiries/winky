import { type BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { log } from "./logger";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function createPersistentContext(): Promise<BrowserContext> {
  ensureDir(config.profileDir);
  ensureDir(config.downloadsDir);
  ensureDir(config.screenshotsDir);

  log.info(`Launching persistent context: ${config.profileDir}`);
  log.info(`Headless=${config.headless}, slowMo=${config.slowMo}`);

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    slowMo: config.slowMo,
    acceptDownloads: true,
    downloadsPath: config.downloadsDir,
    viewport: { width: 1365, height: 768 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(60_000);

  return context;
}

export async function saveStorageState(context: BrowserContext) {
  const dir = path.dirname(config.storageStatePath);
  ensureDir(dir);

  await context.storageState({ path: config.storageStatePath });
  log.info(`Saved storageState -> ${config.storageStatePath}`);
}
