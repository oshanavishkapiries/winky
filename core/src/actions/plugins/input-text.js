/**
 * Input Text Action Plugin
 * With smart fallback for finding input fields and visibility checks
 */
const { BaseAction } = require('../base-action');

class InputTextAction extends BaseAction {
    static type = 'input_text';
    static requiresElement = true;
    static description = 'Type text into an input field';

    async execute({ element_id, text }) {
        try {
            let element = null;
            let elementInfo = null;
            let foundViaFallback = false;

            // Try to get element by ID first
            try {
                element = await this.getElement(element_id);
                elementInfo = this.elementMap[element_id];
            } catch (e) {
                foundViaFallback = true;
                console.log(`  [input_text] Element ${element_id} not found, searching...`);
                element = await this.findVisibleInput();
            }

            if (!element) {
                return { success: false, error: `Could not find element ${element_id} or any suitable input field` };
            }

            // Click first to focus (important for Google and other sites)
            try {
                await element.click({ timeout: 2000 });
                await this.page.waitForTimeout(300);
            } catch (e) {
                // Try focus if click fails
                await element.focus().catch(() => { });
            }

            // Clear existing text
            try {
                await element.fill('');
            } catch (e) {
                // Ignore clear error, proceed to type
            }

            // Human-like typing with random delay
            if (text) {
                try {
                    // Random delay between 30ms and 100ms
                    const delay = Math.floor(Math.random() * 70) + 30;
                    await element.pressSequentially(text, { delay });
                } catch (e) {
                    console.log('  [input_text] Typing failed, falling back to instant fill');
                    await element.fill(text);
                }
            }

            // Determine if we should press Enter after input
            const isSearch = this.isSearchInput(elementInfo) || await this.looksLikeSearch(element);
            const isLogin = await this.isLoginInput(element);

            // Press Enter for search inputs (NOT for login forms)
            if (isSearch && !isLogin) {
                console.log(`  [input_text] Pressing Enter for search`);
                await this.page.keyboard.press('Enter');
                await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { });
                await this.page.waitForTimeout(1500);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async isLoginInput(element) {
        try {
            const type = await element.getAttribute('type');
            const name = await element.getAttribute('name');
            const placeholder = await element.getAttribute('placeholder') || '';

            return type === 'password' ||
                type === 'email' ||
                name?.includes('password') ||
                name?.includes('email') ||
                name?.includes('username') ||
                name?.includes('session') ||
                placeholder.toLowerCase().includes('password') ||
                placeholder.toLowerCase().includes('email');
        } catch {
            return false;
        }
    }

    async findVisibleInput() {
        // Priority order - Google uses textarea now
        const selectors = [
            'textarea[name="q"]',              // Google main search
            'input[name="q"]',                 // Google fallback
            'textarea[aria-label*="Search"]',
            'input[type="search"]',
            '[role="combobox"]',
            '[role="searchbox"]',
            'input[aria-label*="Search"]',
            'input[placeholder*="Search"]',
            'input[name="search"]'
        ];

        for (const selector of selectors) {
            const els = await this.page.$$(selector);
            for (const el of els) {
                const box = await el.boundingBox();
                // Check visibility: has size and is in viewport
                if (box && box.width > 50 && box.height > 15) {
                    console.log(`  [input_text] Found via: ${selector}`);
                    return el;
                }
            }
        }

        // Last resort: any visible text input
        const inputs = await this.page.$$('input[type="text"], input:not([type]), textarea');
        for (const inp of inputs) {
            const box = await inp.boundingBox();
            if (box && box.width > 100 && box.height > 15) {
                console.log(`  [input_text] Found generic input`);
                return inp;
            }
        }

        return null;
    }

    async looksLikeSearch(element) {
        try {
            const name = await element.getAttribute('name');
            const type = await element.getAttribute('type');
            const ariaLabel = await element.getAttribute('aria-label') || '';

            return name === 'q' ||
                type === 'search' ||
                ariaLabel.toLowerCase().includes('search');
        } catch {
            return false;
        }
    }

    isSearchInput(elementInfo) {
        if (!elementInfo) return false;
        return [
            elementInfo.type === 'search',
            elementInfo.name?.toLowerCase()?.includes('search'),
            elementInfo.name === 'q',
            elementInfo['aria-label']?.toLowerCase()?.includes('search'),
            elementInfo.placeholder?.toLowerCase()?.includes('search'),
            elementInfo.role === 'searchbox'
        ].some(Boolean);
    }
}

module.exports = InputTextAction;
