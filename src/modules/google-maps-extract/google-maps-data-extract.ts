import type { Page } from "playwright";
import { log } from "../../core/logger";
import {
  initTable,
  salonExists,
  saveSalon,
  generateSalonHash,
} from "./repository";
import { type SalonData } from "./types";

export async function googleMapsDataExtract(page: Page) {
  log.info(`Initializing Database...`);
  await initTable();

  log.info(`Going to Google Maps...`);
  await page.goto(
    "https://www.google.com/maps/search/salons+in+colombo+district/",
    { waitUntil: "domcontentloaded" },
  );

  const title = await page.title();
  log.info(`Title: ${title}`);

  log.info("Waiting for the feed container to load...");
  const feed = page.getByRole("feed");
  await feed.waitFor({ state: "visible", timeout: 15000 });

  let scrapedCount = 0;
  let previousItemCount = 0;
  let stagnantScrolls = 0;
  const targetItems = 1000;

  log.info("Starting to scrape salons...");

  while (scrapedCount < targetItems) {
    const articles = page.getByRole("article");
    const count = await articles.count();

    for (let i = 0; i < count; i++) {
      const articlesList = page.getByRole("article");
      if (i >= (await articlesList.count())) break;
      const article = articlesList.nth(i);

      try {
        const linkEl = article.getByRole("link").first();
        const url = await linkEl.getAttribute("href");
        if (!url) continue;

        const rawName =
          (await article.getAttribute("aria-label")) ?? "Unknown Name";

        // 1. DEDUPLICATION TRACKER CHECK
        const hashId = generateSalonHash(rawName, url);
        if (await salonExists(hashId)) {
          // Skip silently to quickly resume to the breaking point.
          continue;
        }

        log.info(`Processing new salon: ${rawName}`);
        await article.scrollIntoViewIfNeeded();
        await article.click();
        await page.waitForTimeout(3000); // Wait for pane animation to settle

        const pane = page.getByRole("main").last();
        if (!(await pane.isVisible())) continue;

        // ---- 2. OVERVIEW TAB DATA ----
        const overviewText = await pane.innerText();
        const overviewLines = overviewText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Best effort basic parse based on common Maps structure:
        const name = rawName;
        // Looking for rating (e.g. "4.8(123)")
        const ratingLine = overviewLines.find(
          (l) =>
            typeof l === "string" &&
            l.includes("(") &&
            l.includes(")") &&
            !isNaN(parseFloat(l[0])),
        );

        let phone = null;
        let website = null;

        for (const line of overviewLines) {
          // Basic phone match logic (contains digits and spaces typically)
          if (
            /^[\d\s+\-\()]{8,15}$/.test(line.replace(/[^0-9+]/g, "")) &&
            line.length > 8
          ) {
            phone = line;
          }
          // Basic website match logic
          if (
            line.includes(".com") ||
            line.includes(".lk") ||
            line.includes(".net") ||
            line.includes(".org")
          ) {
            if (line.indexOf(" ") === -1 && line.length > 5) website = line;
          }
        }

        // Address is usually near the top, often containing "Colombo"
        const addressMatch = overviewLines.find(
          (l) =>
            l.toLowerCase().includes("colombo") &&
            l.length > 10 &&
            !l.includes("Opens") &&
            !l.includes("("),
        );

        // ---- 3. REVIEWS TAB DATA ----
        let searchTags: string[] = [];
        let reviewsText: string[] = [];

        try {
          // In English UI, Tab text is exactly "Reviews"
          const reviewsTab = page.getByRole("tab", { name: "Reviews" });
          if (await reviewsTab.isVisible()) {
            await reviewsTab.click();
            await page.waitForTimeout(1500); // let reviews load

            // "Sort" buttons or "All" badges often contain the search tags.
            const rawReviewText = await pane.innerText();
            const revLines = rawReviewText
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);

            // Heuristic to grab search tags: they usually appear between "Sort" / "All" and the first reviewer name.
            let inTags = false;
            for (let j = 0; j < revLines.length; j++) {
              const l = revLines[j];
              if (l === "All") {
                inTags = true;
                continue;
              }
              if (inTags && l.includes("reviews")) break; // end of tags
              if (inTags && l.length < 30 && isNaN(Number(l))) {
                // Only push if it doesn't look like a number
                if (!searchTags.includes(l)) searchTags.push(l);
              }
            }

            // Scroll down a bit in the reviews section to load some
            const scrollableReviewArea = pane.locator(".m6QErb").first();
            if (await scrollableReviewArea.isVisible()) {
              await scrollableReviewArea.evaluate((el) =>
                el.scrollTo(0, el.scrollHeight),
              );
              await page.waitForTimeout(1000);
            }

            // Get Review elements
            const reviewElements = pane.locator("[data-review-id]");
            const reviewCount = await reviewElements.count();
            const limit = Math.min(reviewCount, 20); // Get up to 20

            for (let r = 0; r < limit; r++) {
              const rText = await reviewElements.nth(r).innerText();
              // Clean up the inner text into a flattened string
              reviewsText.push(rText.replace(/\n+/g, " | "));
            }
          }
        } catch (e) {
          log.warn("Failed extracting reviews");
        }

        // ---- 4. ABOUT TAB DATA ----
        let accessibility: string[] = [];
        let amenities: string[] = [];
        let planning: string[] = [];
        let payments: string[] = [];

        try {
          const aboutTab = page.getByRole("tab", { name: "About" });
          if (await aboutTab.isVisible()) {
            await aboutTab.click();
            await page.waitForTimeout(1500);

            const aboutText = await pane.innerText();
            const aLines = aboutText
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);

            let currentSection = "";
            for (const l of aLines) {
              if (l === "Accessibility") {
                currentSection = "Accessibility";
                continue;
              }
              if (l === "Amenities") {
                currentSection = "Amenities";
                continue;
              }
              if (l === "Planning") {
                currentSection = "Planning";
                continue;
              }
              if (l === "Payments") {
                currentSection = "Payments";
                continue;
              }

              // If we found a section identifier, associate following lines to it till next section
              const isHeading =
                l === "Accessibility" ||
                l === "Amenities" ||
                l === "Planning" ||
                l === "Payments" ||
                l === "About" ||
                l === "About this data";
              if (currentSection === "Accessibility" && !isHeading)
                accessibility.push(l);
              if (currentSection === "Amenities" && !isHeading)
                amenities.push(l);
              if (currentSection === "Planning" && !isHeading) planning.push(l);
              if (currentSection === "Payments" && !isHeading) payments.push(l);

              if (l === "About this data") break; // End of section
            }
          }
        } catch (e) {
          log.warn("Failed extracting about sections");
        }

        // ---- 5. SAVE DATA ----
        const data: SalonData = {
          hash_id: hashId,
          name,
          url,
          ratings: ratingLine || "N/A",
          address: addressMatch || null,
          mobile_number: phone,
          website_link: website,
          search_tags: searchTags,
          reviews: reviewsText,
          accessibility,
          amenities,
          planning,
          payments,
        };

        await saveSalon(data);
        scrapedCount++;

        // 6. CLOSING PANE
        const closeBtn = page.locator('button[aria-label="Close"]').last();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(800);
        }

        if (scrapedCount >= targetItems) break;
      } catch (err) {
        log.warn(`Error extracting data for an article: ${err}`);
        const closeBtn = page.locator('button[aria-label="Close"]').last();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click().catch(() => {});
          await page.waitForTimeout(800);
        }
      }
    }

    if (scrapedCount >= targetItems) {
      log.info(
        `Reached target of ${targetItems} newly scraped items. Stopping.`,
      );
      break;
    }

    log.info(`Scraping loop advancing. Attempting to scroll feed...`);
    await feed.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(2500);

    const newCount = await articles.count();
    if (newCount === previousItemCount) {
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

  log.info(`Finished scraping run!`);
}
