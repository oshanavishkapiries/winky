import type { Page } from "playwright";
import { log } from "../../core/logger";

export async function exampleTask(page: Page) {
  log.info(`Going to "google.com"`);
  await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });

  const title = await page.title();
  log.info(`Title: ${title}`);

  // ✅ Put your scraping logic here later
  // e.g., await page.locator('...').textContent()

  await page.waitForTimeout(30 * 60 * 1000);


}
