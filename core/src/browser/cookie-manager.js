/**
 * CookieManager - Handles cookie loading and management (Single Responsibility)
 * Loads cookies from files, transforms to Playwright format, and applies to browser
 */
const fs = require('fs');
const path = require('path');

class CookieManager {
    constructor(cookiesDir, browserManager) {
        this.cookiesDir = cookiesDir || path.join(__dirname, '..', 'data', 'cookies');
        this.browserManager = browserManager;
    }

    /**
     * Ensure cookies directory exists
     */
    ensureDir() {
        if (!fs.existsSync(this.cookiesDir)) {
            fs.mkdirSync(this.cookiesDir, { recursive: true });
            return false; // Directory was created, no cookies exist
        }
        return true;
    }

    /**
     * Get list of available cookie files
     * @returns {string[]}
     */
    getAvailableFiles() {
        if (!this.ensureDir()) return [];
        return fs.readdirSync(this.cookiesDir).filter(file => file.endsWith('.json'));
    }

    /**
     * Transform cookies from browser export format to Playwright format
     * @param {Array} rawCookies
     * @returns {Array}
     */
    transformCookies(rawCookies) {
        return rawCookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            expires: c.expires || c.expirationDate || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite: c.sameSite === 'no_restriction' ? 'None' :
                c.sameSite === 'lax' ? 'Lax' :
                    c.sameSite === 'strict' ? 'Strict' : 'None'
        }));
    }

    /**
     * Load cookies for a specific domain
     * @param {string} domain - Domain name (e.g., 'linkedin.com')
     * @returns {Promise<{loaded: boolean, count: number, file: string}>}
     */
    async loadForDomain(domain) {
        const files = this.getAvailableFiles();

        for (const file of files) {
            const fileDomain = file.replace('.json', '').toLowerCase();
            if (fileDomain === domain.toLowerCase() || domain.toLowerCase().includes(fileDomain)) {
                return await this.loadFromFile(file);
            }
        }

        return { loaded: false, count: 0, file: null };
    }

    /**
     * Load cookies from a specific file
     * @param {string} filename
     * @returns {Promise<{loaded: boolean, count: number, file: string}>}
     */
    async loadFromFile(filename) {
        const filepath = path.join(this.cookiesDir, filename);

        try {
            const cookieData = fs.readFileSync(filepath, 'utf8');
            const rawCookies = JSON.parse(cookieData);

            if (Array.isArray(rawCookies) && rawCookies.length > 0) {
                const cookies = this.transformCookies(rawCookies);
                await this.browserManager.addCookies(cookies);
                return { loaded: true, count: cookies.length, file: filename };
            }
        } catch (error) {
            console.error(`[cookies] Error loading ${filename}: ${error.message}`);
        }

        return { loaded: false, count: 0, file: filename };
    }

    /**
     * Smart cookie loading - checks goal and URL for domain matches
     * @param {string} goal - User's goal text
     * @param {string} url - URL being navigated to
     * @returns {Promise<{loaded: boolean, count: number, file: string}>}
     */
    async loadFromGoalAndUrl(goal, url = '') {
        const files = this.getAvailableFiles();

        if (files.length === 0) {
            return { loaded: false, count: 0, file: null, message: 'No cookie files found' };
        }

        // Combine goal and URL for matching
        const searchText = `${goal} ${url}`.toLowerCase();

        for (const file of files) {
            const domain = file.replace('.json', '').toLowerCase();
            const shortName = domain.split('.')[0]; // e.g., "linkedin" from "linkedin.com"

            // Check if goal OR url contains this domain or short name
            if (searchText.includes(domain) || searchText.includes(shortName)) {
                const result = await this.loadFromFile(file);
                if (result.loaded) {
                    return result;
                }
            }
        }

        return { loaded: false, count: 0, file: null, message: 'No matching cookies for goal/url' };
    }
}

module.exports = { CookieManager };
