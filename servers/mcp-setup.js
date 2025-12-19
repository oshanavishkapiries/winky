
/**
 * MCP Server Factory
 * Shared logic for creating the Winky MCP Server instance.
 * Used by both Stdio (Local) and SSE (Remote/HTTP) transports.
 */
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { runAgent } = require('../core');
const { DirectBrowserController } = require('../core/src/browser/direct-browser-controller');
const { registry } = require('../core/src/actions/action-registry');
const tools = require('./mcp-tools.json');

// Ensure plugins are loaded
registry.loadPlugins();

// Shared state for Direct Mode (must be shared if valid within same process)
// Note: In an HTTP server context, we might want one controller per session?
// For now, we replicate the specific single-controller behavior of the CLI.
let directController = null;
let currentSession = null;
let actionLogs = [];

/**
 * Create and configure an MCP Server instance
 * @returns {Server}
 */
function createMcpServer() {
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

    // List Tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });

    // Call Tool
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
                case 'direct_network_monitor': // This might need a custom handler if not auto-mapped
                    // It should be auto-mapped by the generic handler below if it's in the registry
                    break;
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

    // List Resources
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

    // Read Resource
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

    return server;
}

// Helper Functions
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

module.exports = { createMcpServer };
