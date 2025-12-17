
const fs = require('fs');
const path = require('path');

// Ensure we can load env vars
require('./core/node_modules/dotenv').config({ path: path.join(__dirname, 'core', '.env') });

const { registry } = require('./core/src/actions/action-registry');

// Explicitly load plugins
console.log('Loading plugins...');
registry.loadPlugins();
console.log(`Loaded ${registry.actions.size} plugins.`);

console.log('CWD:', process.cwd());
const outputFile = path.join(__dirname, 'servers', 'mcp-tools.json');
console.log('Output File:', outputFile);

// Define Static Tools (Agent & Direct Session)
const staticTools = [
    // 1. Agent Mode
    {
        name: 'browser_run_goal',
        description: '[AGENT MODE] Run automation with configured LLM. The agent autonomously navigates, clicks, types, and extracts data based on your goal.',
        inputSchema: {
            type: 'object',
            properties: {
                goal: {
                    type: 'string',
                    description: 'Natural language goal (e.g., "Go to google and search for weather")'
                },
                headless: {
                    type: 'boolean',
                    description: 'Run browser in headless mode',
                    default: true
                },
                llmProvider: {
                    type: 'string',
                    description: 'LLM provider (gemini, openrouter, ollama)',
                    default: 'gemini'
                }
            },
            required: ['goal']
        }
    },
    // 2. Static Direct Tools
    {
        name: 'direct_open',
        description: '[DIRECT MODE] Open browser and navigate to URL. Returns page state with elements you can interact with.',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL to navigate to'
                },
                headless: {
                    type: 'boolean',
                    description: 'Run in headless mode',
                    default: false
                }
            },
            required: ['url']
        }
    },
    {
        name: 'direct_get_state',
        description: '[DIRECT MODE] Get current page state: simplified HTML and interactive elements with UUIDs. Use this to understand what you can click/type.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'direct_status',
        description: '[DIRECT MODE] Get current browser status and action history.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'direct_close',
        description: '[DIRECT MODE] Close the browser and end the session.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];

// Generate Dynamic Tools from Registry
const dynamicTools = [];
const registeredActions = registry.actions;

for (const [name, ActionClass] of registeredActions) {
    // Skip internal/meta actions if needed
    if (['extract', 'complete', 'terminate'].includes(name)) continue;

    dynamicTools.push({
        name: `direct_${name}`,
        description: `[DIRECT MODE] ${ActionClass.description || name}`,
        inputSchema: ActionClass.inputSchema || { type: 'object', properties: {} }
    });
}

// Combine and Write
const allTools = [...staticTools, ...dynamicTools];

fs.writeFileSync(outputFile, JSON.stringify(allTools, null, 2));

console.log(`Successfully generated ${allTools.length} tools to ${outputFile}`);
console.log('Dynamic tools added:', dynamicTools.map(t => t.name).join(', '));
