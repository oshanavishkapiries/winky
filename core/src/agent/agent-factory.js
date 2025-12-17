/**
 * AgentFactory - Assembles Agent with all dependencies (Dependency Inversion)
 * Open for extension: Add new managers without modifying Agent
 */
const path = require('path');
const { config } = require('../llm');
const { createAdapter } = require('../llm');
const { BrowserManager } = require('../browser/browser-manager');
const { CookieManager } = require('../browser/cookie-manager');
const { SessionManager } = require('../session-manager');
const { PageStateExtractor } = require('../browser/page-state-extractor');
const { ActionExecutor } = require('../actions');
const { AgentTUI } = require('../scripts/tui');
const { ElementHighlighter } = require('../scripts/highlighter');

class AgentFactory {
    /**
     * Create an Agent with all dependencies assembled
     * @param {Object} options
     * @returns {Object} - Assembled dependencies for Agent
     */
    static create(options = {}) {
        const headless = options.headless ?? false;
        const useTUI = options.useTUI ?? true;
        const llmProvider = options.llmProvider ?? config.defaultProvider;

        // Create browser manager
        const browserManager = new BrowserManager({
            headless,
            userDataDir: config.browser?.userDataDir,
            chromePath: config.browser?.chromePath
        });

        // Create cookie manager (needs browserManager)
        const cookieManager = new CookieManager(
            path.join(__dirname, '..', 'data', 'cookies'),
            browserManager
        );

        // Create session manager
        const sessionManager = new SessionManager({
            logs: path.join(__dirname, '..', 'data', 'logs'),
            output: path.join(__dirname, '..', 'data', 'output')
        });

        // Create page state extractor
        const pageStateExtractor = new PageStateExtractor(browserManager, {
            silent: useTUI
        });

        // Create LLM adapter
        const llmAdapter = createAdapter(llmProvider);

        // Create TUI if enabled
        const tui = useTUI ? new AgentTUI() : null;

        return {
            browserManager,
            cookieManager,
            sessionManager,
            pageStateExtractor,
            llmAdapter,
            tui,
            options: {
                headless,
                maxSteps: options.maxSteps ?? config.agent?.maxSteps ?? 50,
                waitBetweenActions: options.waitBetweenActions ?? config.agent?.waitBetweenActions ?? 1000,
                verbose: options.verbose ?? config.agent?.verbose ?? false,
                llmProvider
            }
        };
    }

    /**
     * Create ActionExecutor for a page
     * @param {Page} page
     * @returns {ActionExecutor}
     */
    static createExecutor(page) {
        return new ActionExecutor(page);
    }

    /**
     * Create Highlighter for a page
     * @param {Page} page
     * @returns {ElementHighlighter}
     */
    static createHighlighter(page) {
        return new ElementHighlighter(page);
    }
}

module.exports = { AgentFactory };
