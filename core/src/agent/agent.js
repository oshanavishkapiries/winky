/**
 * Browser Automation Agent (with Memory & Goal Planning)
 * 
 * Features:
 * - Goal planning: Breaks complex goals into sub-tasks
 * - Memory: Short-term, working, and long-term memory
 * - Progress tracking: Loops and step progress
 */
const { parseAction, isTerminal } = require('../actions');
const { AgentFactory } = require('./agent-factory');
const { config } = require('../llm');
const { AgentMemory } = require('./agent-memory');
const { GoalPlanner } = require('./goal-planner');
const { ActionVerifier } = require('./action-verifier');

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
        this.verifier = null;
        this.currentStep = 0;

        // Memory & Planning
        this.memory = new AgentMemory();
        this.planner = new GoalPlanner(this.llm);
        this.plan = null;
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

        // Create action verifier
        this.verifier = new ActionVerifier(page);

        // Create highlighter if not headless
        if (!this.options.headless) {
            this.highlighter = AgentFactory.createHighlighter(page);
            await this.highlighter.injectStyles();
        }
    }

    /**
     * Run the autonomous agent loop with memory
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

            // Plan the goal
            this.log('Planning goal...', 'info');
            this.plan = await this.planner.plan(goal);
            this.memory.setGoalPlan(this.plan);

            if (this.plan.steps.length > 1) {
                this.log(`Plan: ${this.plan.steps.length} steps`, 'info');
            }

            // Set loop target if detected
            if (this.plan.loopCount > 0) {
                this.memory.setLoopTarget(this.plan.loopCount);
                this.log(`Loop target: ${this.plan.loopCount}`, 'info');
            }

            // Remember credentials if present
            if (this.plan.hasCredentials) {
                const usernameMatch = goal.match(/(?:username|email|user)[:\s]*["']?([^\s"']+)/i);
                if (usernameMatch) {
                    this.memory.remember('username', usernameMatch[1]);
                }
            }

            // Load cookies
            const cookieResult = await this.cookieManager.loadFromGoalAndUrl(goal, url);
            if (cookieResult.loaded) {
                this.log(`Loaded ${cookieResult.count} cookies from ${cookieResult.file}`, 'cookie');
                this.memory.remember('cookiesLoaded', true);
            }

            // Navigate
            this.log(`Navigating to ${url.substring(0, 50)}...`, 'nav');
            await this.browserManager.goto(url);
            await this.browserManager.waitForStable();

            // Main automation loop with memory
            while (this.currentStep < this.options.maxSteps) {
                this.currentStep++;
                if (this.tui) {
                    this.tui.updateStep(this.currentStep);
                    this.tui.setStatus('running');
                }

                // Get page state
                const pageState = await this.pageStateExtractor.getState(this.sessionManager.getId());
                const pageUrlBeforeLLM = pageState.url;
                this.executor.setElementMap(pageState.elementMap);

                if (this.tui) {
                    this.tui.printElements(pageState.elementCount);
                }

                // Build context with memory
                if (this.tui) this.tui.setStatus('thinking');
                const memoryContext = this.memory.getContextForLLM();
                const stepContext = this.planner.getStepContext(
                    this.plan,
                    this.memory.workingMemory.currentStep,
                    this.memory.workingMemory.loopCount
                );

                const context = {
                    goal,
                    simplifiedHtml: pageState.simplifiedHtml,
                    elementMap: pageState.elementMap,
                    previousActions: this.sessionManager.getLastActions(5),
                    currentUrl: pageState.url,
                    // Memory context
                    memoryContext: memoryContext,
                    stepContext: stepContext,
                    loopProgress: this.memory.getLoopProgress()
                };

                const rawAction = await this.llm.generateAction(context);
                const action = parseAction(rawAction, pageState.elementMap);

                // STALENESS CHECK: Did page change during LLM call?
                const currentUrl = this.browserManager.getPage().url();
                if (currentUrl !== pageUrlBeforeLLM) {
                    this.log('Page changed during LLM call, refreshing...', 'warning');
                    this.memory.observe('Page changed while waiting for LLM response');
                    // Refresh element map with new page state
                    const freshState = await this.pageStateExtractor.getState(this.sessionManager.getId());
                    this.executor.setElementMap(freshState.elementMap);
                    // Skip this action and re-evaluate on next loop
                    continue;
                }

                // Display action
                if (this.tui) {
                    this.tui.setStatus('acting');
                    this.tui.printAction(action.action_type, action.reasoning);
                } else {
                    console.log(`\n ACTION  ${action.action_type}`);
                    console.log(`└─ ${action.reasoning.substring(0, 80)}...`);
                }

                // Visual highlight with enhanced feedback
                if (this.highlighter) {
                    // Update status panel with step and action
                    await this.highlighter.updateStatusPanel(
                        this.currentStep,
                        action.action_type,
                        action.element_id,
                        action.text || action.url || action.direction
                    );

                    // Highlight element if applicable
                    if (action.element_id) {
                        const elementInfo = pageState.elementMap[action.element_id];
                        await this.highlighter.highlightAction(action.element_id, action.action_type, elementInfo);
                    }

                    // Show action toast
                    const targetInfo = action.element_id || action.url || action.text || 'page';
                    await this.highlighter.showToast(
                        `${action.action_type.toUpperCase()}: ${targetInfo.substring(0, 30)}`,
                        action.action_type
                    );
                }

                // Capture state before action for verification
                await this.verifier.captureState();

                // Execute action
                const result = await this.executor.execute(action);

                // Verify action caused expected changes
                const verification = await this.verifier.verify(action.action_type);
                const feedback = this.verifier.generateFeedback(action.action_type, verification);

                // Log verification result
                if (!verification.likely_succeeded) {
                    this.log(verification.message, 'warning');
                    this.memory.observe(verification.message);
                } else if (verification.urlChanged) {
                    this.log(feedback, 'nav');
                }

                // Update memory with action and verification
                this.memory.addAction({
                    step: this.currentStep,
                    action_type: action.action_type,
                    element_id: action.element_id,
                    success: result.success,
                    verified: verification.likely_succeeded,
                    pageChanged: verification.urlChanged || verification.contentChanged
                });

                // Extract LLM data before removing from action
                const llmData = action._llmData || null;
                delete action._llmData; // Don't pass this to executor

                // Log action to session with full context
                this.sessionManager.logAction({
                    step: this.currentStep,
                    ...action,
                    pageState: {
                        url: pageState.url,
                        elementCount: pageState.elementCount,
                        simplifiedHtml: pageState.simplifiedHtml,
                        elementMap: pageState.elementMap
                    },
                    llm: llmData ? {
                        model: llmData.model,
                        prompt: llmData.prompt,
                        response: llmData.response,
                        usage: llmData.usage
                    } : null,
                    result: {
                        success: result.success,
                        error: result.error,
                        verification: verification
                    }
                });

                // Check for terminal actions
                if (isTerminal(action.action_type)) {
                    // Check if we're in a loop and need to continue
                    const loopProgress = this.memory.getLoopProgress();

                    if (loopProgress.target > 0 && loopProgress.remaining > 0) {
                        // Not done with loop - increment and continue
                        const loopState = this.memory.incrementLoop();
                        this.log(`Loop progress: ${loopState.current}/${loopState.target}`, 'info');

                        // Observe what we completed
                        this.memory.observe(`Completed iteration ${loopState.current}`);

                        // Continue loop - don't break
                        continue;
                    }

                    this.log(`Task ${action.action_type}`, 'success');

                    if (action.extracted_data) {
                        this.sessionManager.setExtractedData(action.extracted_data);
                    }
                    break;
                }

                // Detect and remember important observations
                if (action.action_type === 'input_text' && action.element_id) {
                    const elemInfo = pageState.elementMap[action.element_id];
                    if (elemInfo?.type === 'password') {
                        this.memory.remember('passwordEntered', true);
                    }
                    if (elemInfo?.name === 'email' || elemInfo?.type === 'email') {
                        this.memory.remember('emailEntered', true);
                    }
                }

                if (action.action_type === 'click') {
                    // Check for login/submit buttons
                    const elemInfo = pageState.elementMap[action.element_id];
                    const text = elemInfo?.text?.toLowerCase() || '';
                    if (text.includes('sign in') || text.includes('login') || text.includes('log in')) {
                        this.memory.observe('Clicked login button');
                    }
                    if (text.includes('apply') || text.includes('submit')) {
                        this.memory.observe('Clicked apply/submit button');
                        // If applying to job, increment loop
                        if (this.memory.getLoopProgress().target > 0) {
                            const loopState = this.memory.incrementLoop();
                            this.log(`Applied: ${loopState.current}/${loopState.target}`, 'success');
                        }
                    }
                }

                // Wait between actions
                await this.browserManager.getPage().waitForTimeout(this.options.waitBetweenActions);
            }
        } catch (error) {
            this.log(`Error: ${error.message}`, 'error');
            if (this.tui) this.tui.setStatus('error');
        } finally {
            // Save and close
            const results = await this.sessionManager.saveResults({
                status: 'completed',
                loopProgress: this.memory.getLoopProgress()
            });
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
     * Get current status including memory
     */
    getStatus() {
        return {
            ...this.sessionManager.getStatus(),
            currentStep: this.currentStep,
            browserRunning: this.browserManager.isRunning(),
            memory: {
                facts: this.memory.getAllFacts(),
                loopProgress: this.memory.getLoopProgress()
            }
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
        console.log('  npm run agent "Go to linkedin, login and apply to 5 jobs"');
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

    console.log(` Using LLM provider: ${llmProvider}`);

    // Create agent with factory
    const deps = AgentFactory.create({
        headless: args.includes('--headless'),
        verbose: !args.includes('--quiet'),
        llmProvider,
        maxSteps: 100  // Increase default for complex goals
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
