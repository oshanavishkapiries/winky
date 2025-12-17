/**
 * MCP (Model Context Protocol) Server for Browser Automation
 * 
 * TWO MODES:
 * 1. Agent Mode: browser_run_goal - Your configured LLM drives automation
 * 2. Direct Mode: direct_* tools - MCP client LLM drives step-by-step
 * 
 * Usage:
 *   npm run start:mcp
 *   # or
 *   node servers/mcp-server.js
 */

// Load environment variables (CRITICAL for CHROME_PATH)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'core', '.env') });

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

// CRITICAL: Suppress console.log to stderr BEFORE importing any browser modules
// MCP uses stdio for JSON-RPC, any stdout pollution breaks the protocol
const originalConsoleLog = console.log;
console.log = (...args) => {
    console.error('[mcp-redirect]', ...args);
};

const { runAgent } = require('../core');
const { DirectBrowserController } = require('../core/src/browser/direct-browser-controller');
const { registry } = require('../core/src/actions/action-registry');
const tools = require('./mcp-tools.json');

// Ensure plugins are loaded for execution (even if tools are static, we need registry for execution)
registry.loadPlugins();

// Server state
let currentSession = null;
let directController = null; // For direct control mode
let actionLogs = [];

// Create MCP server
const server = new Server(
    {
        name: 'winky',
        version: '2.0.0'
    },
    {
        capabilities: {
            tools: {},
            resources: {}
        }
    }
);

// ============================================================================
// Tools Definition
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        // 1. Agent Mode Handler
        if (name === 'browser_run_goal') {
            const result = await runAgent(args.goal, {
                headless: args.headless ?? true,
                llmProvider: args.llmProvider || 'gemini'
            });

            actionLogs.push({
                timestamp: new Date().toISOString(),
                tool: name,
                goal: args.goal,
                result: result.success
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }

        // 2. Static Direct Tools Handlers
        switch (name) {
            case 'direct_open': {
                if (directController) {
                    await directController.close();
                }
                directController = new DirectBrowserController({
                    headless: args.headless ?? false
                });
                const state = await directController.open(args.url);
                return {
                    content: [{
                        type: 'text',
                        text: `Browser opened at ${args.url}\n\n` +
                            `Found ${state.elementCount} interactive elements.\n\n` +
                            `Top elements:\n${formatElements(state.elements)}\n\n` +
                            `Use direct_get_state for full HTML, or direct_click/direct_type to interact.`
                    }]
                };
            }
            case 'direct_get_state': {
                ensureDirectController();
                const state = await directController.getState();
                return {
                    content: [{
                        type: 'text',
                        text: `URL: ${state.url}\n` +
                            `Elements: ${state.elementCount}\n\n` +
                            `Interactive Elements:\n${formatElements(state.elements)}\n\n` +
                            `Page HTML (truncated):\n\`\`\`html\n${state.html?.substring(0, 5000) || 'No HTML'}\n\`\`\``
                    }]
                };
            }
            case 'direct_status': {
                const status = directController
                    ? directController.getStatus()
                    : { isOpen: false, message: 'No active browser' };
                const history = directController?.getHistory() || [];
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ status, recentActions: history.slice(-10) }, null, 2)
                    }]
                };
            }
            case 'direct_close': {
                if (!directController) {
                    return { content: [{ type: 'text', text: 'No active browser to close.' }] };
                }
                const result = await directController.close();
                directController = null;
                return {
                    content: [{
                        type: 'text',
                        text: `Browser closed. Session: ${result.sessionId}, Total actions: ${result.totalActions}`
                    }]
                };
            }
        }

        // 3. Dynamic Direct Tools Handler
        if (name.startsWith('direct_')) {
            ensureDirectController();

            // Extract action type (remove 'direct_' prefix)
            const actionType = name.replace('direct_', '');

            // Validate action exists
            if (!registry.get(actionType)) {
                throw new Error(`Unknown tool: ${name}`);
            }

            // Execute via controller's executor
            // We need to pass the full action object expected by ActionExecutor
            const action = {
                action_type: actionType,
                ...args
            };

            const result = await directController.actionExecutor.execute(action);

            // If action was successful, refresh state if needed (usually handled by next tool call)
            // But for things like click/goto we might want to return context

            return {
                content: [{
                    type: 'text',
                    text: result.success
                        ? `Action ${actionType} successful.`
                        : `Action ${actionType} failed: ${result.error}`
                }]
            };
        }

        throw new Error(`Unknown tool: ${name}`);

    } catch (error) {
        return {
            content: [{
                type: 'text',
                text: `Error: ${error.message}`
            }],
            isError: true
        };
    }
});

// ============================================================================
// Helper Functions
// ============================================================================

function ensureDirectController() {
    if (!directController || !directController.isOpen) {
        throw new Error('No active browser. Call direct_open first.');
    }
}

function formatElements(elements) {
    if (!elements || elements.length === 0) return 'No elements found';

    return elements.slice(0, 30).map(el => {
        const parts = [`${el.id}: <${el.tag}>`];
        if (el.text) parts.push(`"${el.text}"`);
        if (el.type) parts.push(`[type=${el.type}]`);
        if (el.placeholder) parts.push(`[placeholder="${el.placeholder}"]`);
        if (el.href) parts.push(`[href=${el.href.substring(0, 50)}]`);
        return parts.join(' ');
    }).join('\n');
}

// ============================================================================
// Resources
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: 'browser://status',
                name: 'Browser Status',
                description: 'Current browser session status',
                mimeType: 'application/json'
            },
            {
                uri: 'browser://logs',
                name: 'Action Logs',
                description: 'Recent browser automation action logs',
                mimeType: 'application/json'
            }
        ]
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
        case 'browser://status':
            const status = directController?.getStatus() ||
                currentSession?.getStatus() ||
                { active: false };
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(status, null, 2)
                }]
            };

        case 'browser://logs':
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(actionLogs.slice(-20), null, 2)
                }]
            };

        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Browser Automation MCP Server v2.0 running on stdio');
    console.error('Modes: Agent (browser_run_goal) | Direct (direct_* tools)');
}

main().catch(console.error);

