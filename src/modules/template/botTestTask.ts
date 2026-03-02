import type { Page } from "playwright";
import path from "node:path";
import { log } from "../../core/logger";
import { config } from "../../config";

export async function botTestTask(page: Page) {
  log.info(`Going to SannySoft Bot Test...`);
  await page.goto("https://bot.sannysoft.com/", { waitUntil: "networkidle" });

  const title = await page.title();
  log.info(`Title: ${title}`);

  // Let the page fully render the test results
  await page.waitForTimeout(5000);

  const shot = path.join(
    config.screenshotsDir,
    `sannysoft-test-${Date.now()}.png`,
  );
  await page.screenshot({ path: shot, fullPage: true });
  log.info(`Saved Stealth test screenshot to: ${shot}`);
}
