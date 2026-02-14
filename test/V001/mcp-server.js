const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { chromium } = require("playwright");

let browser;
let context;
let page;

const server = new Server(
  {
    name: "playwright-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "playwright_navigate",
        description: "Navigate to a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
      {
        name: "playwright_click",
        description: "Click an element using a selector",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
          },
          required: ["selector"],
        },
      },
      {
        name: "playwright_fill",
        description: "Fill an input field",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
            value: { type: "string" },
          },
          required: ["selector", "value"],
        },
      },
      {
        name: "playwright_evaluate",
        description: "Execute JavaScript in the page context",
        inputSchema: {
          type: "object",
          properties: {
            script: { type: "string" },
          },
          required: ["script"],
        },
      },
      {
        name: "playwright_screenshot",
        description: "Take a screenshot of the current page",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
      {
        name: "playwright_press",
        description: "Press a keyboard key",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "The key to press (e.g., 'Enter', 'Tab')" },
          },
          required: ["key"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const page = await ensureBrowser();

  try {
    switch (name) {
      case "playwright_navigate":
        await page.goto(args.url);
        return {
          content: [{ type: "text", text: `Navigated to ${args.url}` }],
        };

      case "playwright_click":
        await page.click(args.selector);
        return {
          content: [{ type: "text", text: `Clicked ${args.selector}` }],
        };

      case "playwright_fill":
        await page.fill(args.selector, args.value);
        return {
          content: [{ type: "text", text: `Filled ${args.selector} with ${args.value}` }],
        };

      case "playwright_evaluate":
        const result = await page.evaluate(args.script);
        return {
          content: [{ type: "text", text: `Result: ${JSON.stringify(result)}` }],
        };

      case "playwright_screenshot":
        const screenshotName = args.name || `screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotName });
        return {
          content: [{ type: "text", text: `Screenshot saved as ${screenshotName}` }],
        };

      case "playwright_press":
        await page.keyboard.press(args.key);
        return {
          content: [{ type: "text", text: `Pressed key: ${args.key}` }],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Playwright MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
