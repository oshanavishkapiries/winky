#!/usr/bin/env node
/**
 * Skill Runner CLI
 * 
 * Run skills from the command line with natural language commands.
 * 
 * @example
 * npm run skill "scrape 20 coffee shops in London from google maps"
 * npm run skill "find 10 hotels in New York"
 */

require('dotenv').config();

const { SkillOrchestrator } = require('../skills');
const { BrowserManager } = require('../browser/browser-manager');
const { createAdapter } = require('../llm');
const { PageStateExtractor } = require('../browser/page-state-extractor');
const { ActionExecutor } = require('../actions');

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: npm run skill "<natural language command>"');
        console.log('');
        console.log('Examples:');
        console.log('  npm run skill "scrape 20 coffee shops in London from google maps"');
        console.log('  npm run skill "find 10 hotels in New York"');
        console.log('  npm run skill "extract restaurants in Tokyo"');
        process.exit(1);
    }

    // Get command
    const userCommand = args.join(' ');
    console.log('\n🎯 Skill Runner');
    console.log(`📝 Command: "${userCommand}"\n`);

    // Parse options
    const isHeadless = args.includes('--headless');
    const llmProvider = process.env.LLM_PROVIDER || 'gemini';

    // Create dependencies
    const browserManager = new BrowserManager({
        headless: isHeadless,
        chromePath: process.env.CHROME_PATH
    });

    const llmAdapter = createAdapter(llmProvider);
    console.log(`🤖 LLM: ${llmAdapter.getModelInfo?.()?.model || llmProvider}`);

    // Create orchestrator
    const orchestrator = new SkillOrchestrator(llmAdapter);
    orchestrator.loadPlugins();

    const registeredSkills = orchestrator.getSkillsMetadata();
    console.log(`📦 Loaded ${registeredSkills.length} skills: ${registeredSkills.map(s => s.type).join(', ')}\n`);

    try {
        // Launch browser
        const { page } = await browserManager.launch();
        console.log('🌐 Browser launched\n');

        // Create executor
        const { ActionExecutor } = require('../actions');
        const executor = new ActionExecutor(page);

        // Dependencies for skills
        const deps = {
            browserManager,
            executor,
            llm: llmAdapter,
            pageStateExtractor: new PageStateExtractor(page)
        };

        // Route and execute
        const result = await orchestrator.routeAndExecute(userCommand, deps);

        if (result.success) {
            console.log('\n✅ Skill completed successfully!');
            console.log(`📊 Results: ${JSON.stringify(result.result, null, 2)}`);
        } else {
            console.log('\n❌ Skill failed');
            console.log(`Error: ${result.error}`);
            if (result.routing) {
                console.log(`Routing: ${JSON.stringify(result.routing, null, 2)}`);
            }
        }

    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        if (process.env.VERBOSE) {
            console.error(error.stack);
        }
    } finally {
        await browserManager.close();
        console.log('\n🔒 Browser closed');
    }
}

main().catch(console.error);
