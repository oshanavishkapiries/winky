/**
 * MCP (Model Context Protocol) Server for Browser Automation
 * 
 * Exposes browser automation capabilities as MCP tools.
 * Can be connected to Claude Desktop, VS Code, or any MCP client.
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

const { BrowserAutomationAPI, runAgent } = require('../index');

// Server state
let currentSession = null;
let lastPageState = null;
let actionLogs = [];

// Create MCP server
const server = new Server(
    {
        name: 'browser-automation',
        version: '1.0.0'
    },
    {
        capabilities: {
            tools: {},
            resources: {}
        }
    }
);

// ============================================================================
// Tools
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'browser_run_goal',
                description: 'Run the browser automation agent with a natural language goal. The agent will autonomously navigate, click, type, and extract data.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        goal: {
                            type: 'string',
                            description: 'Natural language description of what to accomplish (e.g., "Go to google and search for weather")'
                        },
                        headless: {
                            type: 'boolean',
                            description: 'Run browser in headless mode (default: true)',
                            default: true
                        },
                        llmProvider: {
                            type: 'string',
                            description: 'LLM provider to use (gemini, openrouter, ollama)',
                            default: 'gemini'
                        }
                    },
                    required: ['goal']
                }
            },
            {
                name: 'browser_navigate',
                description: 'Navigate the browser to a specific URL',
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
                name: 'browser_extract',
                description: 'Extract specific data from the current page or a URL',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to extract from (optional, uses current page if not provided)'
                        },
                        extractionGoal: {
                            type: 'string',
                            description: 'What data to extract (e.g., "product names and prices")'
                        }
                    },
                    required: ['extractionGoal']
                }
            },
            {
                name: 'browser_start_session',
                description: 'Start an interactive browser session for multiple operations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        headless: {
                            type: 'boolean',
                            description: 'Run in headless mode',
                            default: false
                        }
                    }
                }
            },
            {
                name: 'browser_close_session',
                description: 'Close the current browser session',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'browser_get_status',
                description: 'Get the current browser session status',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'browser_run_goal': {
                const result = await runAgent(args.goal, {
                    headless: args.headless ?? true,
                    llmProvider: args.llmProvider || 'gemini'
                });

                // Store logs
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

            case 'browser_navigate': {
                const result = await runAgent(`Navigate to ${args.url}`, {
                    headless: true
                });

                return {
                    content: [{
                        type: 'text',
                        text: result.success
                            ? `Successfully navigated to ${args.url}`
                            : `Failed to navigate: ${result.error}`
                    }]
                };
            }

            case 'browser_extract': {
                const goal = args.url
                    ? `Go to ${args.url} and extract ${args.extractionGoal}`
                    : `Extract ${args.extractionGoal} from current page`;

                const result = await runAgent(goal, { headless: true });

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            case 'browser_start_session': {
                if (currentSession) {
                    await currentSession.close();
                }

                currentSession = new BrowserAutomationAPI({
                    headless: args.headless ?? false
                });

                return {
                    content: [{
                        type: 'text',
                        text: 'Browser session started. Use browser_run_goal to execute tasks.'
                    }]
                };
            }

            case 'browser_close_session': {
                if (currentSession) {
                    await currentSession.close();
                    currentSession = null;
                    return {
                        content: [{
                            type: 'text',
                            text: 'Browser session closed.'
                        }]
                    };
                }
                return {
                    content: [{
                        type: 'text',
                        text: 'No active session to close.'
                    }]
                };
            }

            case 'browser_get_status': {
                const status = currentSession
                    ? currentSession.getStatus()
                    : { active: false, message: 'No active session' };

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(status, null, 2)
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
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(
                        currentSession?.getStatus() || { active: false },
                        null, 2
                    )
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
    console.error('Browser Automation MCP Server running on stdio');
}

main().catch(console.error);
