/**
 * Browser Automation Core - Unified API
 * 
 * Main entry point for all browser automation functionality.
 * Import this module to access agent, managers, and utilities.
 * 
 * @example
 * const { runAgent, BrowserAutomationAPI } = require('./core');
 * 
 * // Quick run
 * const result = await runAgent('Go to google and search for weather');
 * 
 * // Full API
 * const api = new BrowserAutomationAPI();
 * await api.run('Search for hotels in Atlanta');
 */

// Core Agent
const { Agent, AgentFactory } = require('./src/agent/agent');

// Managers
const { BrowserManager } = require('./src/browser/browser-manager');
const { CookieManager } = require('./src/browser/cookie-manager');
const { SessionManager } = require('./src/session-manager');
const { PageStateExtractor } = require('./src/browser/page-state-extractor');

// LLM
const {
    config: llmConfig,
    createAdapter,
    BaseLLMAdapter,
    GeminiAdapter,
    CerebrasAdapter,
    OllamaAdapter,
    OpenRouterAdapter
} = require('./src/llm');

// Actions
const {
    ActionExecutor,
    ActionRegistry,
    BaseAction,
    parseAction,
    parseActions,
    ActionType,
    isTerminal
} = require('./src/actions');

// Goal Planning & Memory
const { GoalPlanner } = require('./src/agent/goal-planner');
const { AgentMemory } = require('./src/agent/agent-memory');

// Workflow
const { WkyExecutor } = require('./src/wky-executor');

// Skills
const { BaseSkill, SkillOrchestrator, skills } = require('./src/skills');

// High-level API
const { BrowserAutomationAPI } = require('./src/api');

/**
 * Quick helper to run agent with a goal
 * @param {string} goal - Natural language goal
 * @param {Object} options - Agent options
 * @returns {Promise<Object>} - Execution results
 */
async function runAgent(goal, options = {}) {
    const api = new BrowserAutomationAPI(options);
    try {
        return await api.run(goal);
    } finally {
        await api.close();
    }
}

/**
 * Quick helper to extract data from URL
 * @param {string} url - URL to extract from
 * @param {string} extractionGoal - What to extract
 * @param {Object} options - Agent options
 * @returns {Promise<Object>} - Extracted data
 */
async function extractFromUrl(url, extractionGoal, options = {}) {
    const goal = `Go to ${url} and ${extractionGoal}`;
    return runAgent(goal, options);
}

/**
 * Execute a .wky workflow file
 * @param {string} wkyPath - Path to .wky file
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} - Execution results
 */
async function executeWorkflow(wkyPath, options = {}) {
    const executor = new WkyExecutor(options);
    return executor.execute(wkyPath);
}

module.exports = {
    // High-level API
    BrowserAutomationAPI,
    runAgent,
    extractFromUrl,
    executeWorkflow,

    // Core classes
    Agent,
    AgentFactory,

    // Managers
    BrowserManager,
    CookieManager,
    SessionManager,
    PageStateExtractor,

    // LLM
    llmConfig,
    createAdapter,
    BaseLLMAdapter,
    GeminiAdapter,
    CerebrasAdapter,
    OllamaAdapter,
    OpenRouterAdapter,

    // Actions
    ActionExecutor,
    ActionRegistry,
    BaseAction,
    parseAction,
    parseActions,
    ActionType,
    isTerminal,

    // Planning & Memory
    GoalPlanner,
    AgentMemory,

    // Workflow
    WkyExecutor,

    // Skills
    BaseSkill,
    SkillOrchestrator,
    skills
};
