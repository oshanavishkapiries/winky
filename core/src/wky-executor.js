/**
 * WKY Executor - Execute actions from .wky workflow files
 * 
 * .wky (Winky) format - JSON with .wky extension
 * Named after Winky the dog 🐕
 * 
 * Usage: npm run wky <workflow-file.wky>
 * Example: npm run wky data/workflows/login-flow.wky
 */

const fs = require('fs');
const path = require('path');

const { config } = require('./llm/config');
const { BrowserManager } = require('./browser/browser-manager');
const { ActionExecutor } = require('./actions/action-executor');
const { SessionManager } = require('./session-manager');

class WkyExecutor {
    constructor(options = {}) {
        this.headless = options.headless || false;
        this.browserManager = null;
        this.executor = null;
        this.sessionManager = new SessionManager();
        this.actions = [];
        this.delayBetweenActions = options.delay || 1000;
        this.workflowName = '';
    }

    /**
     * Load actions from .wky file
     */
    loadWorkflow(wkyPath) {
        const absolutePath = path.isAbsolute(wkyPath)
            ? wkyPath
            : path.join(process.cwd(), wkyPath);

        // Validate .wky extension
        if (!absolutePath.endsWith('.wky')) {
            throw new Error(`Invalid file format. Expected .wky file, got: ${path.extname(absolutePath)}`);
        }

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Workflow file not found: ${absolutePath}`);
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        this.actions = JSON.parse(content);
        this.workflowName = path.basename(absolutePath, '.wky');

        console.log(`[wky] 🐕 Loaded workflow: ${this.workflowName}`);
        console.log(`[wky] ${this.actions.length} actions to execute`);
        return this.actions;
    }

    /**
     * Initialize browser
     */
    async initialize() {
        console.log('[wky] Starting browser...');

        this.browserManager = new BrowserManager({
            headless: this.headless,
            chromePath: config.browser?.chromePath,
            userDataDir: config.browser?.userDataDir
        });

        await this.browserManager.launch();
        this.executor = new ActionExecutor(this.browserManager.getPage());

        console.log('[wky] Browser ready');
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browserManager) {
            await this.browserManager.close();
        }
    }

    /**
     * Execute all actions from workflow
     */
    async execute() {
        console.log(`\n[wky] 🐕 Executing workflow: ${this.workflowName}\n`);
        console.log('─'.repeat(50));

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < this.actions.length; i++) {
            const action = this.actions[i];
            const step = action.step || i + 1;

            console.log(`\n[Step ${step}] ${action.action_type.toUpperCase()}`);
            if (action.reasoning) {
                console.log(`  ${(action.reasoning).substring(0, 60)}...`);
            }

            try {
                // Wait before action
                await this.browserManager.getPage().waitForTimeout(this.delayBetweenActions);

                // Build action for executor
                const execAction = {
                    action_type: action.action_type,
                    element_id: action.element_id,
                    element_info: action.element_info,
                    text: action.text,
                    url: action.url,
                    direction: action.direction,
                    amount: action.amount,
                    keys: action.keys,
                    seconds: action.seconds,
                    x: action.x,
                    y: action.y,
                    button: action.button
                };

                // Execute action
                const result = await this.executor.execute(execAction);

                if (result.success) {
                    console.log(`  ✓ Success`);
                    successCount++;
                } else {
                    console.log(`  ✗ Failed: ${result.error}`);
                    failCount++;
                }

                // Log to session
                this.sessionManager.logAction({
                    step,
                    ...execAction,
                    result,
                    workflow: this.workflowName
                });

                // Check for terminal actions
                if (['complete', 'terminate'].includes(action.action_type)) {
                    console.log(`\n[wky] Terminal action reached`);
                    break;
                }

            } catch (error) {
                console.log(`  ✗ Error: ${error.message}`);
                failCount++;

                this.sessionManager.logAction({
                    step,
                    action_type: action.action_type,
                    result: { success: false, error: error.message },
                    workflow: this.workflowName
                });
            }
        }

        console.log('\n' + '─'.repeat(50));
        console.log(`[wky] 🐕 Complete: ${successCount} success, ${failCount} failed`);
        console.log('─'.repeat(50));

        // Save execution log
        const results = await this.sessionManager.saveResults({
            status: 'wky_executed',
            workflow: this.workflowName
        });
        console.log(`[wky] Log saved: ${results.outputFiles[0]?.path}`);

        return { successCount, failCount };
    }
}

// CLI entry point
async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    let headless = false;
    let delay = 1000;
    let wkyPath = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--headless') {
            headless = true;
        } else if (args[i] === '--delay' && args[i + 1]) {
            delay = parseInt(args[i + 1], 10);
            i++;
        } else if (!args[i].startsWith('--')) {
            wkyPath = args[i];
        }
    }

    if (!wkyPath) {
        console.log('🐕 WKY Executor - Run .wky workflow files\n');
        console.log('Usage: npm run wky <workflow.wky> [--headless] [--delay <ms>]');
        console.log('\nExamples:');
        console.log('  npm run wky data/workflows/login.wky');
        console.log('  npm run wky data/workflows/search.wky --headless');
        console.log('  npm run wky data/workflows/checkout.wky --delay 2000');
        process.exit(1);
    }

    const executor = new WkyExecutor({ headless, delay });

    try {
        executor.loadWorkflow(wkyPath);
        await executor.initialize();
        await executor.execute();
    } catch (error) {
        console.error(`[wky] Error: ${error.message}`);
    } finally {
        await executor.close();
    }
}

// CLI entry point - only run when executed directly
if (require.main === module) {
    main();
}

module.exports = { WkyExecutor };


