/**
 * BrowserManager - Handles browser lifecycle (Single Responsibility)
 * Manages Playwright browser context, page, and stealth settings
 */
const path = require('path');
const fs = require('fs');
// const { chromium } = require('playwright-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { chromium } = require('playwright');
const { NetworkMonitor } = require('./network-monitor');

// Use stealth plugin to avoid bot detection
// chromium.use(StealthPlugin());

class BrowserManager {
    constructor(config = {}) {
        const baseDataDir = process.env.DATA_DIR
            ? path.resolve(process.env.DATA_DIR)
            : path.join(__dirname, '..', '..', '..', 'data');

        this.config = {
            headless: config.headless ?? false,
            userDataDir: config.userDataDir || path.join(baseDataDir, 'browser-profile'),
            chromePath: config.chromePath || null,
            viewport: config.viewport || { width: 1024, height: 768 },
            userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: config.locale || 'en-US',
            timezoneId: config.timezoneId || 'Asia/Colombo'
        };

        this.context = null;
        this.page = null;
    }

    /**
     * Launch browser with persistent context
     * @returns {Promise<{context, page}>}
     */
    async launch() {
        // Ensure profile directory exists
        if (!fs.existsSync(this.config.userDataDir)) {
            fs.mkdirSync(this.config.userDataDir, { recursive: true });
        }

        // Launch persistent context (saves cookies, history, localStorage)

        // Fix: Patch preferences to prevent "Restore pages?" popup
        this.fixProfileExitStatus();

        // CRITICAL: executablePath must be undefined (not null) if not set to use bundled
        this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
            executablePath: this.config.chromePath || undefined,
            headless: this.config.headless,
            viewport: this.config.viewport,
            userAgent: this.config.userAgent,
            locale: this.config.locale,
            timezoneId: this.config.timezoneId,
            ignoreHTTPSErrors: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-session-crashed-bubble',
                '--hide-crash-restore-bubble',
                '--disable-infobars'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        // Get or create page
        this.page = this.context.pages()[0] || await this.context.newPage();

        // Attach network monitor
        this.networkMonitor = new NetworkMonitor(this.page);
        this.page._networkMonitor = this.networkMonitor; // Access for plugins

        return { context: this.context, page: this.page };
    }

    /**
     * Navigate to a URL
     * @param {string} url
     * @param {Object} options
     */
    async goto(url, options = {}) {
        const defaultOptions = {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        };
        await this.page.goto(url, { ...defaultOptions, ...options });
    }

    /**
     * Get the current page
     * @returns {Page}
     */
    getPage() {
        return this.page;
    }

    /**
     * Get the browser context
     * @returns {BrowserContext}
     */
    getContext() {
        return this.context;
    }

    /**
     * Add cookies to the browser context
     * @param {Array} cookies
     */
    async addCookies(cookies) {
        if (this.context) {
            await this.context.addCookies(cookies);
        }
    }

    /**
     * Get current page URL
     * @returns {string}
     */
    getCurrentUrl() {
        return this.page ? this.page.url() : '';
    }

    /**
     * Get page content (HTML)
     * @returns {Promise<string>}
     */
    async getContent() {
        return this.page ? await this.page.content() : '';
    }

    /**
     * Wait for page to be stable (not navigating)
     */
    async waitForStable() {
        try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
                // Network idle timeout is ok, page might have long-polling
            });
        } catch (error) {
            // If timeout, page should still be usable
            await this.page.waitForTimeout(2000);
        }
    }

    /**
     * Close browser
     */
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
            this.page = null;
        }
    }

    /**
     * Patch the Preferences file to prevent crash restore bubble
     */
    fixProfileExitStatus() {
        const preferencesPath = path.join(this.config.userDataDir, 'Default', 'Preferences');
        try {
            if (fs.existsSync(preferencesPath)) {
                const content = fs.readFileSync(preferencesPath, 'utf8');
                let prefs = JSON.parse(content);

                // Force clean exit status
                if (prefs.profile) {
                    prefs.profile.exit_type = 'Normal';
                    prefs.profile.exited_cleanly = true;
                    prefs.profile.should_restore_immediately = false;
                }

                // Write back
                fs.writeFileSync(preferencesPath, JSON.stringify(prefs, null, 2));
                // console.log('[BrowserManager] Patched Preferences for clean exit');
            }
        } catch (error) {
            console.error('[BrowserManager] Failed to patch Preferences:', error.message);
        }
    }

    /**
     * Check if browser is running
     * @returns {boolean}
     */
    isRunning() {
        return this.context !== null;
    }
}

module.exports = { BrowserManager };
