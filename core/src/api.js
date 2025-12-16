/**
 * BrowserAutomationAPI - High-level programmatic API
 * 
 * Provides a clean, Promise-based interface for browser automation.
 * Suitable for integration with HTTP servers, MCP servers, etc.
 */
const path = require('path');
const { Agent, AgentFactory } = require('./agent');
const { WkyExecutor } = require('./wky-executor');

class BrowserAutomationAPI {
    /**
     * Create a new API instance
     * @param {Object} options - Configuration options
     * @param {boolean} options.headless - Run browser in headless mode (default: true for API)
     * @param {string} options.llmProvider - LLM provider to use
     * @param {number} options.maxSteps - Maximum steps per goal
     * @param {boolean} options.verbose - Enable verbose logging
     */
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini',
            maxSteps: options.maxSteps || 50,
            verbose: options.verbose ?? false,
            useTUI: false // Disable TUI for API usage
        };

        this.agent = null;
        this.deps = null;
        this.isRunning = false;
        this.lastResult = null;
    }

    /**
     * Run agent with a natural language goal
     * @param {string} goal - The goal to achieve
     * @param {string} startUrl - Optional starting URL
     * @returns {Promise<Object>} - Execution results
     */
    async run(goal, startUrl = 'about:blank') {
        if (this.isRunning) {
            throw new Error('Agent is already running. Wait for completion or call close()');
        }

        this.isRunning = true;

        try {
            // Create fresh dependencies for each run
            this.deps = AgentFactory.create(this.options);
            this.agent = new Agent(this.deps);

            // Run the agent
            const result = await this.agent.run(startUrl, goal);
            this.lastResult = result;

            return {
                success: true,
                status: result.status,
                steps: result.steps,
                duration: result.time,
                output: result.output,
                extractedData: result.extractedData || null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: this.options.verbose ? error.stack : undefined
            };
        } finally {
            this.isRunning = false;
            await this.close();
        }
    }

    /**
     * Execute a .wky workflow file
     * @param {string} wkyPath - Path to workflow file
     * @returns {Promise<Object>} - Execution results
     */
    async executeWorkflow(wkyPath) {
        if (this.isRunning) {
            throw new Error('Agent is already running');
        }

        this.isRunning = true;

        try {
            const executor = new WkyExecutor({
                headless: this.options.headless,
                verbose: this.options.verbose
            });

            const result = await executor.execute(wkyPath);
            return {
                success: true,
                ...result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get current status
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastResult: this.lastResult,
            options: this.options
        };
    }

    /**
     * Close browser and cleanup resources
     */
    async close() {
        if (this.deps?.browserManager) {
            try {
                await this.deps.browserManager.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        this.agent = null;
        this.deps = null;
    }
}

module.exports = { BrowserAutomationAPI };
