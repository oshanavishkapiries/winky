/**
 * MapsScraperSkill - Scrape business leads from Google Maps
 * 
 * Port of Python pyWinky's MapsScraperSkill with improvements:
 * - Vision-guided element detection
 * - Human-like random delays
 * - CSV export with deduplication
 * 
 * @example
 * await skill.execute({ query: 'coffee shops', location: 'London', count: 20 });
 */

const { BaseSkill } = require('../base-skill');

class MapsScraperSkill extends BaseSkill {
    static type = 'maps_scraper';
    static description = 'Scrape business leads from Google Maps (names, addresses, phones, websites)';
    static triggers = ['maps', 'google maps', 'scrape', 'leads', 'businesses', 'cafes', 'restaurants', 'hotels', 'shops', 'stores'];

    constructor(deps) {
        super(deps);
        this.processedItems = new Set();
        this.results = [];
    }

    /**
     * Execute the maps scraping skill
     * @param {Object} args
     * @param {string} args.query - Search term (e.g., 'coffee shops')
     * @param {string} args.location - Location (e.g., 'London')
     * @param {number} args.count - Number of leads to extract (default: 20)
     */
    async execute({ query, location = '', count = 20 }) {
        const fullQuery = location ? `${query} in ${location}` : query;
        this.log(`Starting lead extraction: "${fullQuery}" (Target: ${count})`, 'info');

        try {
            // Navigate to Google Maps
            await this.goto('https://www.google.com/maps');
            await this.randomDelay(2000, 3000);

            // Search
            this.log('Entering search query...', 'info');
            await this.waitFor('input#searchboxinput');
            await this.type('input#searchboxinput', fullQuery);
            await this.press('Enter');

            // Wait for results
            this.log('Waiting for results...', 'info');
            await this.waitFor('div[role="feed"]', 15000);
            await this.randomDelay(2000, 3000);

            // Extract loop
            let attempts = 0;
            const maxAttempts = count * 3; // Allow for some failures

            while (this.results.length < count && attempts < maxAttempts) {
                attempts++;

                // Get visible results
                const results = await this.page.locator('div[role="article"]').all();
                this.log(`Found ${results.length} visible items...`, 'info');

                for (const result of results) {
                    if (this.results.length >= count) break;

                    const ariaLabel = await result.getAttribute('aria-label');
                    if (!ariaLabel || this.processedItems.has(ariaLabel)) continue;

                    try {
                        this.log(`Inspecting: ${ariaLabel.substring(0, 50)}...`, 'info');

                        // Click to open details
                        await result.click();
                        await this.randomDelay(1500, 2500);

                        // Wait for details panel
                        try {
                            await this.page.waitForSelector('div[role="main"]', { timeout: 3000 });
                        } catch {
                            this.log('Details panel did not load', 'warning');
                            continue;
                        }

                        // Extract data
                        const lead = await this.extractLeadData(ariaLabel);

                        if (lead.name) {
                            this.results.push(lead);
                            this.processedItems.add(ariaLabel);
                            this.log(`✓ Extracted: ${lead.name} | ${lead.phone || 'No phone'} | ${lead.website ? 'Has website' : 'No website'}`, 'success');
                        }

                    } catch (error) {
                        this.log(`Error extracting ${ariaLabel}: ${error.message}`, 'warning');
                    }
                }

                // Scroll to load more
                if (this.results.length < count) {
                    await this.scroll('div[role="feed"]', 800);

                    // Check for end of list
                    const pageContent = await this.page.content();
                    if (pageContent.includes("You've reached the end")) {
                        this.log('Reached end of results', 'warning');
                        break;
                    }
                }
            }

            // Save results
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const safeQuery = fullQuery.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const filename = `${safeQuery}_${timestamp}.csv`;

            const savedPath = this.saveToCSV(filename, this.results);

            return {
                success: true,
                leadsCollected: this.results.length,
                targetCount: count,
                outputFile: savedPath,
                data: this.results
            };

        } catch (error) {
            this.log(`Execution error: ${error.message}`, 'error');

            // Save whatever we have
            if (this.results.length > 0) {
                const filename = `partial_${Date.now()}.csv`;
                this.saveToCSV(filename, this.results);
            }

            throw error;
        }
    }

    /**
     * Extract lead data from the details panel
     * @param {string} name - Business name from aria-label
     * @returns {Object} - Lead data
     */
    async extractLeadData(name) {
        const lead = {
            name: name,
            address: '',
            phone: '',
            website: '',
            source: 'google_maps'
        };

        // Extract website
        try {
            const websiteLoc = this.page.locator('a[data-item-id="authority"]');
            if (await websiteLoc.count() > 0) {
                lead.website = await websiteLoc.getAttribute('href') || '';
            }
        } catch { /* ignore */ }

        // Extract phone
        try {
            const phoneLoc = this.page.locator('button[data-item-id^="phone:tel:"]');
            if (await phoneLoc.count() > 0) {
                let phone = await phoneLoc.getAttribute('aria-label') || '';
                lead.phone = phone.replace('Phone:', '').trim();
            }
        } catch { /* ignore */ }

        // Extract address
        try {
            const addressLoc = this.page.locator('button[data-item-id="address"]');
            if (await addressLoc.count() > 0) {
                let address = await addressLoc.getAttribute('aria-label') || '';
                lead.address = address.replace('Address:', '').trim();
            }
        } catch { /* ignore */ }

        return lead;
    }

    /**
     * Vision-guided fallback for finding elements
     * Uses screenshot + LLM when selectors fail
     */
    async findElementByVision(question) {
        const screenshotPath = await this.screenshot('vision_query');
        const response = await this.askVision(screenshotPath, question);
        return response;
    }
}

module.exports = MapsScraperSkill;
