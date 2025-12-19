/**
 * BaseSkill - Abstract base class for all skills
 * 
 * Skills are high-level automation modules that accomplish specific tasks
 * using the underlying browser actions and LLM capabilities.
 * 
 * @example
 * class MapsScraperSkill extends BaseSkill {
 *     static type = 'maps_scraper';
 *     static description = 'Scrape business leads from Google Maps';
 *     static triggers = ['maps', 'scrape', 'leads', 'businesses'];
 *     
 *     async execute({ query, location, count }) { ... }
 * }
 */

const fs = require('fs');
const path = require('path');

class BaseSkill {
    // Static metadata - override in subclasses
    static type = 'unknown';
    static description = 'Base skill - do not use directly';
    static triggers = [];

    /**
     * @param {Object} deps - Dependencies injected from SkillOrchestrator
     * @param {Object} deps.browserManager - Browser manager instance
     * @param {Object} deps.executor - Action executor instance
     * @param {Object} deps.llm - LLM adapter instance
     * @param {Object} deps.pageStateExtractor - Page state extractor
     */
    constructor(deps) {
        this.browserManager = deps.browserManager;
        this.executor = deps.executor;
        this.llm = deps.llm;
        this.pageStateExtractor = deps.pageStateExtractor;
        this.page = null;
        this.name = this.constructor.type;

        // Output directory for skill results
        this.outputDir = path.join(process.cwd(), 'data', 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Main execution method - MUST be implemented by subclasses
     * @param {Object} args - Arguments extracted by orchestrator
     * @returns {Promise<Object>} - Execution result
     */
    async execute(args) {
        throw new Error(`execute() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Initialize browser and get page reference
     */
    async initialize() {
        if (!this.browserManager.isRunning()) {
            await this.browserManager.launch();
        }
        this.page = this.browserManager.getPage();
        this.log('Skill initialized', 'info');
    }

    /**
     * Navigate to a URL
     * @param {string} url - URL to navigate to
     */
    async goto(url) {
        this.log(`Navigating to ${url}`, 'nav');
        await this.page.goto(url);
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Click an element by selector
     * @param {string} selector - CSS selector
     */
    async click(selector) {
        await this.page.click(selector);
        await this.randomDelay(500, 1000);
    }

    /**
     * Type text into an input
     * @param {string} selector - CSS selector
     * @param {string} text - Text to type
     */
    async type(selector, text) {
        await this.page.fill(selector, text);
        await this.randomDelay(300, 600);
    }

    /**
     * Press a key
     * @param {string} key - Key to press (e.g., 'Enter')
     */
    async press(key) {
        await this.page.keyboard.press(key);
        await this.randomDelay(500, 1000);
    }

    /**
     * Take a screenshot and return the path
     * @param {string} name - Screenshot name
     * @returns {Promise<string>} - Path to screenshot
     */
    async screenshot(name = 'skill_screenshot') {
        const screenshotPath = path.join(this.outputDir, `${name}_${Date.now()}.png`);
        await this.page.screenshot({ path: screenshotPath });
        return screenshotPath;
    }

    /**
     * Ask the LLM to analyze a screenshot (vision-guided)
     * @param {string} imagePath - Path to screenshot
     * @param {string} question - Question to ask about the image
     * @returns {Promise<string>} - LLM's response
     */
    async askVision(imagePath, question) {
        if (this.llm.analyzeImage) {
            return await this.llm.analyzeImage(imagePath, question);
        }
        // Fallback: use text-based analysis of page content
        const content = await this.page.content();
        const prompt = `Based on this HTML, ${question}\n\nHTML:\n${content.substring(0, 5000)}`;
        return await this.llm.generateRaw(prompt);
    }

    /**
     * Wait for a selector with human-like random delay
     * @param {string} selector - CSS selector
     * @param {number} timeout - Max wait time in ms
     */
    async waitFor(selector, timeout = 10000) {
        await this.page.waitForSelector(selector, { timeout });
        await this.randomDelay(500, 1000);
    }

    /**
     * Scroll within an element or the page
     * @param {string} selector - Optional element selector
     * @param {number} amount - Pixels to scroll
     */
    async scroll(selector = null, amount = 500) {
        if (selector) {
            await this.page.hover(selector);
        }
        await this.page.mouse.wheel(0, amount);
        await this.randomDelay(1000, 2000);
    }

    /**
     * Human-like random delay
     * @param {number} min - Minimum ms
     * @param {number} max - Maximum ms
     */
    async randomDelay(min = 1000, max = 2000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await this.page.waitForTimeout(delay);
    }

    /**
     * Save data to CSV file
     * @param {string} filename - Output filename
     * @param {Array<Object>} data - Array of objects to save
     * @returns {string} - Path to saved file
     */
    saveToCSV(filename, data) {
        if (!data || data.length === 0) {
            this.log('No data to save', 'warning');
            return null;
        }

        const csvPath = path.join(this.outputDir, filename);
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(h => {
                    const val = row[h] || '';
                    // Escape commas and quotes
                    return `"${String(val).replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');

        fs.writeFileSync(csvPath, csvContent, 'utf-8');
        this.log(`Saved ${data.length} records to ${csvPath}`, 'success');
        return csvPath;
    }

    /**
     * Log a message with color coding
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, success, warning, error, nav)
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [${this.name}]`;

        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            nav: '\x1b[35m'      // Magenta
        };

        const color = colors[level] || colors.info;
        const reset = '\x1b[0m';

        console.log(`${color}${prefix} ${message}${reset}`);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        // Subclasses can override for specific cleanup
        this.log('Skill cleanup complete', 'info');
    }
}

module.exports = { BaseSkill };
