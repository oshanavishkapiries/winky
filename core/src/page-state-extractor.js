/**
 * PageStateExtractor - Extracts and simplifies page state (Single Responsibility)
 */
const fs = require('fs');
const path = require('path');
const { simplifyHTML } = require('./scripts/simplify-html');

class PageStateExtractor {
    constructor(browserManager, options = {}) {
        this.browserManager = browserManager;
        this.tempDir = options.tempDir || path.join(__dirname, '..', 'data', 'temp');
        this.silent = options.silent || false;
    }

    /**
     * Wait for page to be stable
     */
    async waitForStable() {
        await this.browserManager.waitForStable();
    }

    /**
     * Get the current page state (simplified HTML + element map)
     * @param {string} sessionId - Session ID for temp file naming
     * @returns {Promise<Object>}
     */
    async getState(sessionId) {
        // Wait for page stability
        await this.waitForStable();

        // Get current HTML
        const html = await this.browserManager.getContent();
        const url = this.browserManager.getCurrentUrl();

        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Save to temp file for simplification
        const tempFile = path.join(this.tempDir, `page_${sessionId}_${Date.now()}.html`);
        fs.writeFileSync(tempFile, html, 'utf8');

        // Simplify HTML
        const result = simplifyHTML(tempFile, { silent: this.silent });

        // Clean up temp file
        this.cleanupTempFile(tempFile);

        return {
            url,
            simplifiedHtml: result.simplifiedHTML,
            elementMap: result.elementMap,
            elementCount: Object.keys(result.elementMap).length
        };
    }

    /**
     * Clean up temp file with retry (handle file locking)
     * @param {string} tempFile
     */
    cleanupTempFile(tempFile) {
        setTimeout(() => {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (e) {
                // Retry once more after delay
                setTimeout(() => {
                    try {
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                    } catch (e2) {
                        // Give up, OS will clean up temp eventually
                    }
                }, 500);
            }
        }, 100);
    }
}

module.exports = { PageStateExtractor };
