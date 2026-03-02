import type { Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { log } from "../../core/logger";

export async function googleMapsDataExtract(page: Page) {
  log.info(`Going to Google Maps`);
  await page.goto("https://www.google.com/maps/search/salons+in+colombo+district/", { waitUntil: "domcontentloaded" });

  const title = await page.title();
  log.info(`Title: ${title}`);

  log.info("Waiting for the feed container to load...");
  const feed = page.getByRole("feed");
  await feed.waitFor({ state: "visible", timeout: 15000 });

  const scrapedData: any[] = [];
  const processedUrls = new Set<string>();
  let previousItemCount = 0;
  let stagnantScrolls = 0;

  const targetItems = 1000;

  // Let's create an output directory
  const outDir = path.resolve("./output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFilePath = path.join(outDir, "salons.json");

  log.info("Starting to scrape salons...");

  while (scrapedData.length < targetItems) {
    const articles = page.getByRole("article");
    const count = await articles.count();

    for (let i = 0; i < count; i++) {
      const articlesList = page.getByRole("article");

      // Re-evaluate the article locator in case of DOM changes
      if (i >= (await articlesList.count())) break;
      const article = articlesList.nth(i);

      try {
        const linkEl = article.getByRole("link").first();
        const url = await linkEl.getAttribute("href");

        if (!url || processedUrls.has(url)) continue;

        // 1. Scroll article into view so we can click it reliably
        await article.scrollIntoViewIfNeeded();

        // 2. Click the article to open the details pane
        await article.click();

        // Wait for the detail panel to load over the list
        // Typically a new main element appears with an aria-label, and the URL might slightly change
        await page.waitForTimeout(3000);

        const detailMains = page.getByRole("main");
        const detailMain = detailMains.last();
        const textContent = await detailMain.innerText();

        const lines = textContent
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Name is likely the first or second meaningful line or we can use the aria-label of the article
        const name =
          (await article.getAttribute("aria-label")) ?? "Unknown Name";

        const dataInfo = {
          name,
          url,
          detailLines: lines,
        };

        scrapedData.push(dataInfo);
        processedUrls.add(url);

        // 3. Click the close/back button to return to the list
        // In Google Maps, this is an element with aria-label="Close" on the detail pane
        const closeBtn = page.locator('button[aria-label="Close"]').last();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(1000); // Wait for the transition back to the feed
        }

        // Incremental save
        fs.writeFileSync(outFilePath, JSON.stringify(scrapedData, null, 2));

        if (scrapedData.length >= targetItems) break;
      } catch (err) {
        log.warn(`Error extracting data for an article: ${err}`);
        // Attempt to close if something went wrong inside the detail view
        const closeBtn = page.locator('button[aria-label="Close"]').last();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click().catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }

    if (scrapedData.length >= targetItems) {
      log.info(`Reached target of ${targetItems} items. Stopping.`);
      break;
    }

    log.info(`Scraped ${scrapedData.length} items so far. Scrolling...`);

    // Scroll the feed to the bottom
    await feed.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight);
    });

    // Wait some time for Google Maps to load the next chunk
    await page.waitForTimeout(2500);

    const newCount = await articles.count();
    if (newCount === previousItemCount) {
      // Sometimes it loads an inner spinner or just takes longer
      stagnantScrolls++;
      if (stagnantScrolls > 4) {
        log.warn(
          "No new items loaded after multiple scroll attempts. We may have hit the end of the results.",
        );
        break;
      }
    } else {
      stagnantScrolls = 0;
    }
    previousItemCount = newCount;
  }

  log.info(`Finished scraping. Total items saved: ${scrapedData.length}`);
  log.info(`Data saved to ${outFilePath}`);
}
