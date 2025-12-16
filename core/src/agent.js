/**
 * Browser Automation Agent (SOLID Refactored)
 * 
 * S - Single Responsibility: Agent only orchestrates the automation loop
 * O - Open/Closed: Extend by adding new managers, not modifying Agent
 * L - Liskov: All managers can be swapped with compatible implementations
 * I - Interface Segregation: Each manager has focused interface
 * D - Dependency Inversion: Agent depends on abstractions (managers), not concretions
 */
const { parseAction, isTerminal } = require('./actions');
const { AgentFactory } = require('./agent-factory');
const { config } = require('./llm');

class Agent {
    /**
     * @param {Object} deps - Injected dependencies from AgentFactory
     */
    constructor(deps) {
        // Injected dependencies
        this.browserManager = deps.browserManager;
        this.cookieManager = deps.cookieManager;
        this.sessionManager = deps.sessionManager;
        this.pageStateExtractor = deps.pageStateExtractor;
        this.llm = deps.llmAdapter;
        this.tui = deps.tui;
        this.options = deps.options;

        // Runtime state
        this.executor = null;
        this.highlighter = null;
        this.currentStep = 0;
    }

    /**
     * Initialize browser and create executor
     */
    async initialize() {
        this.log('Starting agent...', 'info');
        this.log(`LLM: ${this.llm.getModelInfo().model}`, 'llm');

        const { page } = await this.browserManager.launch();
        this.log('Browser ready', 'success');

        // Create executor for the page
        this.executor = AgentFactory.createExecutor(page);

        // Create highlighter if not headless
        if (!this.options.headless) {
            this.highlighter = AgentFactory.createHighlighter(page);
            await this.highlighter.injectStyles();
        }
    }

    /**
     * Run the autonomous agent loop
     * @param {string} url - Starting URL
     * @param {string} goal - User's goal
     * @returns {Object} - Execution result
     */
    async run(url, goal) {
        // Start TUI
        if (this.tui) {
            this.tui.start(url, goal);
            this.tui.maxSteps = this.options.maxSteps;
        } else {
            console.log('\n[agent] Browser Automation Agent');
            console.log(`[url] ${url}`);
            console.log(`[goal] ${goal}`);
        }

        try {
            // Initialize
            if (this.tui) this.tui.setStatus('initializing');
            await this.initialize();

            // Load cookies
            const cookieResult = await this.cookieManager.loadFromGoalAndUrl(goal, url);
            if (cookieResult.loaded) {
                this.log(`Loaded ${cookieResult.count} cookies from ${cookieResult.file}`, 'cookie');
            } else {
                this.log(cookieResult.message || 'No matching cookies', 'warning');
            }

            // Navigate
            this.log(`Navigating to ${url.substring(0, 50)}...`, 'nav');
            await this.browserManager.goto(url);
            await this.browserManager.waitForStable();

            // Main automation loop
            while (this.currentStep < this.options.maxSteps) {
                this.currentStep++;
                if (this.tui) {
                    this.tui.updateStep(this.currentStep);
                    this.tui.setStatus('running');
                }

                // Get page state
                const pageState = await this.pageStateExtractor.getState(this.sessionManager.getId());
                this.executor.setElementMap(pageState.elementMap);

                if (this.tui) {
                    this.tui.printElements(pageState.elementCount);
                }

                // Get action from LLM
                if (this.tui) this.tui.setStatus('thinking');
                const context = {
                    goal,
                    simplifiedHtml: pageState.simplifiedHtml,
                    elementMap: pageState.elementMap,
                    previousActions: this.sessionManager.getLastActions(5),
                    currentUrl: pageState.url
                };

                const rawAction = await this.llm.generateAction(context);
                const action = parseAction(rawAction, pageState.elementMap);

                // Display action
                if (this.tui) {
                    this.tui.setStatus('acting');
                    this.tui.printAction(action.action_type, action.reasoning);
                } else {
                    console.log(`\n ACTION  ${action.action_type}`);
                    console.log(`└─ ${action.reasoning.substring(0, 80)}...`);
                }

                // Visual highlight
                if (this.highlighter && action.element_id) {
                    await this.highlighter.highlightAction(action.element_id, action.action_type);
                    await this.highlighter.showToast(`${action.action_type.toUpperCase()}: ${action.element_id}`, 'action');
                }

                // Execute action
                const result = await this.executor.execute(action);

                // Log action
                this.sessionManager.logAction({
                    step: this.currentStep,
                    ...action,
                    result: { success: result.success, error: result.error }
                });

                // Check for terminal actions
                if (isTerminal(action.action_type)) {
                    this.log(`Task ${action.action_type}`, 'success');

                    if (action.extracted_data) {
                        this.sessionManager.setExtractedData(action.extracted_data);
                    }
                    break;
                }

                // Wait between actions
                await this.browserManager.getPage().waitForTimeout(this.options.waitBetweenActions);
            }
        } catch (error) {
            this.log(`Error: ${error.message}`, 'error');
            if (this.tui) this.tui.setStatus('error');
        } finally {
            // Save and close
            const results = await this.sessionManager.saveResults({ status: 'completed' });
            await this.browserManager.close();
            this.log('Browser closed', 'info');

            // Show results
            if (this.tui) {
                this.tui.printResults(results);
            }

            return results;
        }
    }

    /**
     * Log message via TUI or console
     */
    log(message, type = 'info') {
        if (this.tui) {
            this.tui.log(message, type);
        } else {
            const prefix = type === 'success' ? '[done]' : type === 'error' ? '[error]' : `[${type}]`;
            console.log(`${prefix} ${message}`);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            ...this.sessionManager.getStatus(),
            currentStep: this.currentStep,
            browserRunning: this.browserManager.isRunning()
        };
    }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: npm run agent "<goal>"');
        console.log('Examples:');
        console.log('  npm run agent "Go to google.com and search for weather"');
        console.log('  npm run agent "Go to linkedin and find 5 jobs"');
        process.exit(1);
    }

    // Parse --llm flag
    let llmProvider = config.defaultProvider;
    const llmIndex = args.indexOf('--llm');
    if (llmIndex !== -1 && args[llmIndex + 1]) {
        llmProvider = args[llmIndex + 1];
    }

    // Get goal (all non-flag args joined)
    const nonFlagArgs = args.filter((arg, i) => {
        if (arg.startsWith('--')) return false;
        if (i > 0 && args[i - 1] === '--llm') return false;
        return true;
    });

    let url = 'about:blank';
    let goal = '';

    // Check if first arg is explicit URL
    const firstArg = nonFlagArgs[0];
    if (firstArg && (firstArg.startsWith('http://') || firstArg.startsWith('https://'))) {
        url = firstArg;
        goal = nonFlagArgs.slice(1).join(' ');
    } else {
        goal = nonFlagArgs.join(' ');
    }

    console.log(`🤖 Using LLM provider: ${llmProvider}`);

    // Create agent with factory
    const deps = AgentFactory.create({
        headless: args.includes('--headless'),
        verbose: !args.includes('--quiet'),
        llmProvider
    });

    const agent = new Agent(deps);

    try {
        await agent.run(url, goal);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { Agent, AgentFactory };
