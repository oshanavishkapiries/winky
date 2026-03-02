import type { Page } from "playwright";
import { config } from "../config";
import { log } from "../core/logger";

export async function exampleTask(page: Page) {
  log.info(`Going to ${config.baseUrl}`);
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });

  const title = await page.title();
  log.info(`Title: ${title}`);

  // ✅ Put your scraping logic here later
  // e.g., await page.locator('...').textContent()
}
