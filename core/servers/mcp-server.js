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

const { BrowserAutomationAPI, runAgent } = require('../index');
const { DirectBrowserController } = require('../src/direct-browser-controller');

// Server state
let currentSession = null;
let directController = null; // For direct control mode
let actionLogs = [];

// Create MCP server
const server = new Server(
    {
        name: 'browser-automation',
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
    return {
        tools: [
            // ==================== AGENT MODE (Your LLM drives) ====================
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

            // ==================== DIRECT MODE (You drive step-by-step) ====================
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
                name: 'direct_click',
                description: '[DIRECT MODE] Click an element by its UUID from the element list.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        elementId: {
                            type: 'string',
                            description: 'UUID of element to click (from direct_get_state)'
                        }
                    },
                    required: ['elementId']
                }
            },
            {
                name: 'direct_type',
                description: '[DIRECT MODE] Type text into an input element.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        elementId: {
                            type: 'string',
                            description: 'UUID of input element'
                        },
                        text: {
                            type: 'string',
                            description: 'Text to type'
                        },
                        pressEnter: {
                            type: 'boolean',
                            description: 'Press Enter after typing',
                            default: false
                        }
                    },
                    required: ['elementId', 'text']
                }
            },
            {
                name: 'direct_scroll',
                description: '[DIRECT MODE] Scroll the page.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        direction: {
                            type: 'string',
                            description: 'Scroll direction: up, down, top, bottom',
                            default: 'down'
                        },
                        amount: {
                            type: 'number',
                            description: 'Scroll amount in pixels',
                            default: 500
                        }
                    }
                }
            },
            {
                name: 'direct_goto',
                description: '[DIRECT MODE] Navigate to a new URL.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to navigate to'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'direct_back',
                description: '[DIRECT MODE] Go back in browser history.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'direct_screenshot',
                description: '[DIRECT MODE] Take a screenshot of the current page.',
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
            },
            {
                name: 'direct_status',
                description: '[DIRECT MODE] Get current browser status and action history.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ]
    };
});

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            // ==================== AGENT MODE ====================
            case 'browser_run_goal': {
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

            // ==================== DIRECT MODE ====================
            case 'direct_open': {
                // Close existing controller if any
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

            case 'direct_click': {
                ensureDirectController();
                const result = await directController.click(args.elementId);

                return {
                    content: [{
                        type: 'text',
                        text: result.success
                            ? `Clicked element ${args.elementId}. New URL: ${result.newUrl}`
                            : `Click failed: ${result.error}`
                    }]
                };
            }

            case 'direct_type': {
                ensureDirectController();
                const result = await directController.type(
                    args.elementId,
                    args.text,
                    args.pressEnter ?? false
                );

                return {
                    content: [{
                        type: 'text',
                        text: result.success
                            ? `Typed "${args.text}" into element ${args.elementId}`
                            : `Type failed: ${result.error}`
                    }]
                };
            }

            case 'direct_scroll': {
                ensureDirectController();
                const result = await directController.scroll(
                    args.direction || 'down',
                    args.amount || 500
                );

                return {
                    content: [{
                        type: 'text',
                        text: `Scrolled ${args.direction || 'down'} by ${args.amount || 500}px`
                    }]
                };
            }

            case 'direct_goto': {
                ensureDirectController();
                const result = await directController.goto(args.url);

                return {
                    content: [{
                        type: 'text',
                        text: `Navigated to ${args.url}`
                    }]
                };
            }

            case 'direct_back': {
                ensureDirectController();
                const result = await directController.goBack();

                return {
                    content: [{
                        type: 'text',
                        text: `Went back. Current URL: ${result.url}`
                    }]
                };
            }

            case 'direct_screenshot': {
                ensureDirectController();
                const result = await directController.screenshot();

                return {
                    content: [{
                        type: 'image',
                        data: result.image,
                        mimeType: result.mimeType
                    }]
                };
            }

            case 'direct_close': {
                if (!directController) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'No active browser to close.'
                        }]
                    };
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

            default:
                return {
                    content: [{
                        type: 'text',
                        text: `Unknown tool: ${name}`
                    }],
                    isError: true
                };
        }
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

