/**
 * MCP (Model Context Protocol) Server for Browser Automation
 * MODE: Local Stdio
 * 
 * Usage:
 *   npm run start:mcp
 */

// Load environment variables (CRITICAL for CHROME_PATH)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'core', '.env') });

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./mcp-setup');

// CRITICAL: Suppress console.log to stderr BEFORE importing any browser modules
// MCP uses stdio for JSON-RPC, any stdout pollution breaks the protocol
const originalConsoleLog = console.log;
console.log = (...args) => {
    console.error('[mcp-redirect]', ...args);
};

async function main() {
    // specific error handling for stdio transport
    try {
        const server = createMcpServer();
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('Winky MCP Server v2.0 running on stdio');
    } catch (error) {
        console.error('Fatal MCP Server Error:', error);
        process.exit(1);
    }
}

main();
