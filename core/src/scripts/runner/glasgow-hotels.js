const { BrowserManager } = require('../../browser-manager');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../', '.env') });

// Helper: Randomized sleep to mimic human behavior
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanDelay = async (page, min = 1000, max = 3000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    // Optional: add tiny mouse movement to look alive
    try {
        await page.mouse.move(
            Math.random() * 500,
            Math.random() * 500
        );
    } catch (e) { }
    await sleep(delay);
};

async function runGlasgowScraper() {
    console.log('🚀 Starting Glasgow Hotels Scraper...');

    const config = {
        headless: false, // Visible browser for monitoring
        chromePath: process.env.CHROME_PATH || undefined
    };

    const manager = new BrowserManager(config);

    try {
        await manager.launch();
        const page = await manager.getPage();

        // 1. Navigate to Google Maps
        // The URL provided by the user
        const url = 'https://www.google.com/maps/search/Glasgow+Hotels/@55.8613456,-4.2797385,14.61z/data=!4m2!2m1!6e3?entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoASAFQAw%3D%3D';
        console.log(`📍 Navigating to target URL...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(page, 2000, 4000); // Initial human pause

        // Handle Cookie Consent (if it appears, commonly checks for 'Accept all')
        try {
            const acceptBtn = await page.$('button[aria-label="Accept all"], button:has-text("Accept all")');
            if (acceptBtn) {
                console.log('🍪 Accepting cookies...');
                await acceptBtn.click();
                await humanDelay(page, 1000, 2000);
            }
        } catch (e) { /* clean start */ }

        // 2. Scrolling Logic to load more results
        console.log('📜 Starting scroll sequence...');
        const feedSelector = 'div[role="feed"]';

        // Wait for the feed list to be present
        try {
            await page.waitForSelector(feedSelector, { timeout: 15000 });
        } catch (e) {
            console.log("⚠️ Could not find standard feed selector. Trying fallback strategy...");
        }

        // Loop to scroll
        // Tune this: higher loops = more hotels
        const MAX_SCROLLS = 15;
        for (let i = 0; i < MAX_SCROLLS; i++) {
            console.log(`   ⬇️ Scroll ${i + 1}/${MAX_SCROLLS}`);

            // Hover over the feed to ensures scroll events target it
            try {
                await page.hover(feedSelector);
                // Randomize scroll amount
                await page.mouse.wheel(0, 3000 + Math.random() * 2000);

                // Human wait between scrolls
                await humanDelay(page, 1500, 3500);

                // Occasional "pause to read"
                if (Math.random() > 0.8) {
                    console.log('   👀 "Reading" results...');
                    await humanDelay(page, 2000, 5000);
                }

                // Also try keyboard End key as backup
                if (Math.random() > 0.5) {
                    await page.keyboard.press('End');
                    await page.waitForTimeout(1000);
                }
            } catch (err) {
                // If specific selector fails, try generic body scroll
                await page.keyboard.press('End');
                await humanDelay(page, 2000, 3000);
            }

            // Optional: Check if "You've reached the end of the list" exists
            const endText = await page.$('span:has-text("You\'ve reached the end of the list")');
            if (endText) {
                console.log('   🛑 Reached end of list.');
                break;
            }
        }

        // 3. Collect Links
        const cardSelector = 'a[href*="/maps/place/"]';
        const rawLinks = await page.$$eval(cardSelector, els => els.map(e => e.href));
        // Filter out ads or non-place links if any
        const uniqueLinks = [...new Set(rawLinks)].filter(l => !l.includes('/search/'));

        console.log(`🔎 Found ${uniqueLinks.length} hotels.`);

        const results = [];

        // 4. Extract Details
        // Limit to a reasonable number if testing, or all if production
        // For now, let's do all found
        for (let i = 0; i < uniqueLinks.length; i++) {
            const hotelUrl = uniqueLinks[i];
            console.log(`[${i + 1}/${uniqueLinks.length}] Processing...`);

            try {
                await page.goto(hotelUrl, { waitUntil: 'domcontentloaded' });
                // Human wait for page load + "looking"
                await humanDelay(page, 2000, 4000);

                const data = await page.evaluate(() => {
                    const getText = (sel) => {
                        const el = document.querySelector(sel);
                        return el ? el.innerText.trim() : '';
                    };

                    const getAttribute = (sel, attr) => {
                        const el = document.querySelector(sel);
                        return el ? el.getAttribute(attr) : '';
                    };

                    return {
                        name: getText('h1'),
                        // Rating often in format "4.5 stars" or just "4.5" in a span with aria-label
                        rating: getAttribute('span[aria-label*="stars"]', 'aria-label') || getText('div[role="img"][aria-label*="stars"]'),
                        address: getText('button[data-item-id="address"]'),
                        phone: getText('button[data-item-id^="phone"]'),
                        website: getAttribute('a[data-item-id="authority"]', 'href'),
                        // Add link for reference
                        google_maps_link: window.location.href
                    };
                });

                // Clean up rating text if needed
                if (data.rating) {
                    data.rating = data.rating.replace('stars', '').trim();
                }

                console.log(`   ✅ Extracted: ${data.name}`);
                results.push(data);

            } catch (err) {
                console.error(`   ❌ Failed on ${hotelUrl}:`, err.message);
            }

            // Random short break between items
            await humanDelay(page, 1000, 2500);
        }

        // 5. Save to CSV
        if (results.length > 0) {
            const keys = Object.keys(results[0]);
            const csvHeader = keys.join(',') + '\n';
            const csvRows = results.map(row => {
                return keys.map(k => {
                    let val = row[k] || '';
                    // Escape quotes and wrap in quotes to handle commas in data
                    val = val.toString().replace(/"/g, '""');
                    return `"${val}"`;
                }).join(',');
            }).join('\n');

            const csvContent = csvHeader + csvRows;

            const outPath = path.join(__dirname, '../../../data/glasgow_hotels.csv');
            const dataDir = path.dirname(outPath);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            fs.writeFileSync(outPath, csvContent);
            console.log(`\n💾 Saved ${results.length} records to: ${outPath}`);
        } else {
            console.log('\n⚠️ No results found to save.');
        }

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        await manager.close();
    }
}

runGlasgowScraper();
