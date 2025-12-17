/**
 * DirectBrowserController - Stateful browser controller for MCP direct control
 * 
 * Allows MCP client LLM to control browser step-by-step without delegating
 * to a configured LLM. The MCP client makes all the decisions.
 * 
 * @example
 * const controller = new DirectBrowserController();
 * await controller.open('https://google.com');
 * const state = await controller.getState();
 * // Client analyzes state and decides...
 * await controller.click('uuid-123');
 * await controller.close();
 */

const path = require('path');
const { BrowserManager } = require('./browser-manager');
const { CookieManager } = require('./cookie-manager');
const { PageStateExtractor } = require('./page-state-extractor');
const { ActionExecutor } = require('../actions/action-executor');
const { config } = require('../llm/config');

class DirectBrowserController {
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? false,
            userDataDir: options.userDataDir || config.browser?.userDataDir,
            chromePath: options.chromePath || config.browser?.chromePath
        };

        // Silent mode for MCP - suppress all console output to stdout
        this.silent = options.silent ?? true;
        if (this.silent) {
            this._suppressConsole();
        }

        this.browserManager = null;
        this.cookieManager = null;
        this.pageStateExtractor = null;
        this.actionExecutor = null;
        this.isOpen = false;
        this.currentUrl = null;
        this.sessionId = `direct_${Date.now()}`;
        this.actionHistory = [];
    }

    /**
     * Suppress console.log to prevent stdout pollution in MCP mode
     * @private
     */
    _suppressConsole() {
        this._originalConsoleLog = console.log;
        console.log = (...args) => {
            // Redirect to stderr instead
            console.error('[mcp-silent]', ...args);
        };
    }

    /**
     * Restore console.log
     * @private
     */
    _restoreConsole() {
        if (this._originalConsoleLog) {
            console.log = this._originalConsoleLog;
        }
    }

    /**
     * Open browser and navigate to URL
     * @param {string} url - URL to navigate to
     * @returns {Promise<Object>} - Initial page state
     */
    async open(url) {
        if (this.isOpen) {
            throw new Error('Browser already open. Call close() first.');
        }

        // Initialize browser
        this.browserManager = new BrowserManager(this.options);
        await this.browserManager.launch();

        // Initialize cookie manager
        this.cookieManager = new CookieManager(
            path.join(__dirname, '..', 'data', 'cookies'),
            this.browserManager
        );

        // Initialize page state extractor
        this.pageStateExtractor = new PageStateExtractor(this.browserManager, {
            silent: true
        });

        // Initialize action executor
        this.actionExecutor = new ActionExecutor(this.browserManager.getPage());

        // Load cookies if applicable
        const cookieResult = await this.cookieManager.loadFromGoalAndUrl('', url);

        // Navigate to URL
        await this.browserManager.goto(url);
        await this.browserManager.waitForStable();

        this.isOpen = true;
        this.currentUrl = url;

        // Log action
        this.actionHistory.push({
            action: 'open',
            url,
            timestamp: new Date().toISOString()
        });

        // Return initial state
        return this.getState();
    }

    /**
     * Get current page state (simplified HTML + element map)
     * @returns {Promise<Object>} - Page state with HTML and clickable elements
     */
    async getState() {
        this._ensureOpen();

        const state = await this.pageStateExtractor.getState(this.sessionId);
        this.currentUrl = state.url;

        // Store full element map internally for action execution
        this._elementMap = state.elementMap;
        this.actionExecutor.setElementMap(state.elementMap);

        // Format elements for easier understanding (limited for MCP response)
        const elements = Object.entries(state.elementMap).map(([uuid, info]) => ({
            id: uuid,
            tag: info.tag,
            type: info.type,
            text: info.text?.substring(0, 100),
            name: info.name,
            placeholder: info.placeholder,
            href: info.href?.substring(0, 100)
        }));

        return {
            url: state.url,
            elementCount: state.elementCount,
            elements: elements.slice(0, 50), // Limit for token efficiency
            html: state.simplifiedHtml?.substring(0, 8000) // Limit HTML size
        };
    }

    /**
     * Click an element by UUID
     * @param {string} elementId - UUID of element to click
     * @returns {Promise<Object>} - Result of click action
     */
    async click(elementId) {
        this._ensureOpen();

        const result = await this.actionExecutor.execute({
            action_type: 'click',
            element_id: elementId
        });

        // Wait for page to stabilize
        await this.browserManager.waitForStable();

        this.actionHistory.push({
            action: 'click',
            elementId,
            success: result.success,
            timestamp: new Date().toISOString()
        });

        return {
            success: result.success,
            error: result.error,
            newUrl: this.browserManager.getCurrentUrl()
        };
    }

    /**
     * Type text into an element
     * @param {string} elementId - UUID of input element
     * @param {string} text - Text to type
     * @param {boolean} pressEnter - Whether to press Enter after typing
     * @returns {Promise<Object>} - Result of type action
     */
    async type(elementId, text, pressEnter = false) {
        this._ensureOpen();

        const result = await this.actionExecutor.execute({
            action_type: 'input_text',
            element_id: elementId,
            text: text,
            press_enter: pressEnter
        });

        await this.browserManager.waitForStable();

        this.actionHistory.push({
            action: 'type',
            elementId,
            text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
            success: result.success,
            timestamp: new Date().toISOString()
        });

        return {
            success: result.success,
            error: result.error
        };
    }

    /**
     * Scroll the page
     * @param {string} direction - 'up', 'down', 'top', 'bottom'
     * @param {number} amount - Scroll amount in pixels (default: 500)
     * @returns {Promise<Object>} - Result
     */
    async scroll(direction = 'down', amount = 500) {
        this._ensureOpen();

        const result = await this.actionExecutor.execute({
            action_type: 'scroll',
            direction,
            amount
        });

        await this.browserManager.waitForStable();

        this.actionHistory.push({
            action: 'scroll',
            direction,
            amount,
            timestamp: new Date().toISOString()
        });

        return { success: result.success };
    }

    /**
     * Navigate to a new URL
     * @param {string} url - URL to navigate to
     * @returns {Promise<Object>} - Result
     */
    async goto(url) {
        this._ensureOpen();

        await this.browserManager.goto(url);
        await this.browserManager.waitForStable();

        this.currentUrl = url;

        this.actionHistory.push({
            action: 'goto',
            url,
            timestamp: new Date().toISOString()
        });

        return { success: true, url };
    }

    /**
     * Go back in browser history
     * @returns {Promise<Object>} - Result
     */
    async goBack() {
        this._ensureOpen();

        await this.browserManager.getPage().goBack();
        await this.browserManager.waitForStable();

        this.actionHistory.push({
            action: 'goBack',
            timestamp: new Date().toISOString()
        });

        return { success: true, url: this.browserManager.getCurrentUrl() };
    }

    /**
     * Take a screenshot
     * @returns {Promise<string>} - Base64 encoded screenshot
     */
    async screenshot() {
        this._ensureOpen();

        const screenshot = await this.browserManager.getPage().screenshot({
            type: 'png',
            encoding: 'base64'
        });

        return {
            success: true,
            image: screenshot,
            mimeType: 'image/png'
        };
    }

    /**
     * Analyze page accessibility tree for semantic understanding
     * @returns {Promise<Object>} - Accessibility snapshot
     */
    async analyze() {
        this._ensureOpen();

        try {
            const page = this.browserManager.getPage();

            // Try standard Playwright API first
            if (page.accessibility) {
                const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
                this.actionHistory.push({ action: 'analyze', method: 'playwright', timestamp: new Date().toISOString() });
                return { success: true, snapshot };
            }

            // Fallback to CDP (Chrome DevTools Protocol)
            // Needed because in some environments (System Chrome + Playwright Extra), page.accessibility is missing
            try {
                const client = await page.context().newCDPSession(page);
                const { nodes } = await client.send('Accessibility.getFullAXTree');
                this.actionHistory.push({ action: 'analyze', method: 'cdp', timestamp: new Date().toISOString() });

                // Return raw nodes (LLM can handle it)
                return { success: true, snapshot: { nodes, source: 'cdp' } };
            } catch (cdpError) {
                throw new Error(`CDP fallback failed: ${cdpError.message}`);
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Hover over an element
     * @param {string} elementId - UUID of element
     * @returns {Promise<Object>} - Result
     */
    async hover(elementId) {
        this._ensureOpen();

        const result = await this.actionExecutor.execute({
            action_type: 'hover',
            element_id: elementId
        });

        this.actionHistory.push({
            action: 'hover',
            elementId,
            timestamp: new Date().toISOString()
        });

        return { success: result.success };
    }

    /**
     * Wait for specified seconds
     * @param {number} seconds - Seconds to wait
     * @returns {Promise<Object>} - Result
     */
    async wait(seconds = 2) {
        this._ensureOpen();

        await this.browserManager.getPage().waitForTimeout(seconds * 1000);

        return { success: true, waited: seconds };
    }

    /**
     * Get action history
     * @returns {Array} - List of actions taken
     */
    getHistory() {
        return this.actionHistory;
    }

    /**
     * Get current status
     * @returns {Object} - Current controller status
     */
    getStatus() {
        return {
            isOpen: this.isOpen,
            currentUrl: this.currentUrl,
            sessionId: this.sessionId,
            actionCount: this.actionHistory.length
        };
    }

    /**
     * Close browser and cleanup
     * @returns {Promise<Object>} - Final status
     */
    async close() {
        // Restore console if we suppressed it
        this._restoreConsole();

        if (!this.isOpen) {
            return { success: true, message: 'Already closed' };
        }

        try {
            await this.browserManager.close();
        } catch (e) {
            // Ignore close errors
        }

        this.isOpen = false;

        return {
            success: true,
            sessionId: this.sessionId,
            totalActions: this.actionHistory.length
        };
    }

    /**
     * Ensure browser is open
     * @private
     */
    _ensureOpen() {
        if (!this.isOpen) {
            throw new Error('Browser not open. Call open(url) first.');
        }
    }
}

module.exports = { DirectBrowserController };
