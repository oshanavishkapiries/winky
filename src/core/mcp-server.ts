import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createPersistentContext, saveStorageState } from "./context";
import { config } from "../config";
import { BrowserContext, Page } from "playwright";

// Manage the shared Playwright instances safely within the MCP lifecycle
let globalContext: BrowserContext | null = null;
let activePage: Page | null = null;

const server = new Server(
  {
    name: "winky-playwright-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Ensures the global browser profile is running before executing tools.
 */
async function ensureBrowserReady() {
  if (!globalContext) {
    globalContext = await createPersistentContext({
      profileDir: config.profileDir,
      storageStatePath: config.storageStatePath,
    });
    activePage =
      globalContext.pages().length > 0
        ? globalContext.pages()[0]
        : await globalContext.newPage();
  }
  return { context: globalContext, page: activePage! };
}

/**
 * Register the exposed AI Playwright Tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "winky_navigate",
        description: "Navigate the shared Winky browser to a specific URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The full URL to visit." },
          },
          required: ["url"],
        },
      },
      {
        name: "winky_evaluate",
        description:
          "Run JavaScript on the current page to inspect the DOM or test selectors.",
        inputSchema: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description:
                "JavaScript code to evaluate. It is wrapped in an async function.",
            },
          },
          required: ["script"],
        },
      },
      {
        name: "winky_get_html",
        description: "Returns the outer HTML of the current body tag.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "winky_click",
        description: "Click an element matching the given query selector.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
          },
          required: ["selector"],
        },
      },
      {
        name: "winky_type",
        description: "Type text into an input field matching a selector.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
            text: { type: "string" },
          },
          required: ["selector", "text"],
        },
      },
      {
        name: "winky_save_state",
        description:
          "Saves the current session cookies into Winky's global storageState manually.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

/**
 * Route Tool Invocations
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { page, context } = await ensureBrowserReady();

  try {
    switch (request.params.name) {
      case "winky_navigate": {
        const url = String(request.params.arguments?.url);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return {
          content: [{ type: "text", text: `Successfully navigated to ${url}` }],
        };
      }

      case "winky_evaluate": {
        const script = String(request.params.arguments?.script);
        const result = await page.evaluate(script);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "winky_get_html": {
        const html = await page.evaluate(() => document.body.outerHTML);
        // Truncate if massive to protect context limits
        const safeHtml =
          html.length > 50000
            ? html.substring(0, 50000) + "... [truncated]"
            : html;
        return {
          content: [{ type: "text", text: safeHtml }],
        };
      }

      case "winky_click": {
        const selector = String(request.params.arguments?.selector);
        await page.click(selector);
        return {
          content: [{ type: "text", text: `Clicked ${selector}` }],
        };
      }

      case "winky_type": {
        const selector = String(request.params.arguments?.selector);
        const text = String(request.params.arguments?.text);
        await page.fill(selector, text);
        return {
          content: [{ type: "text", text: `Typed "${text}" into ${selector}` }],
        };
      }

      case "winky_save_state": {
        await saveStorageState(context, config.storageStatePath);
        return {
          content: [
            {
              type: "text",
              text: `Global storage state saved to ${config.storageStatePath}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Winky tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return {
      content: [
        { type: "text", text: `Error executing tool: ${error.message}` },
      ],
      isError: true,
    };
  }
});

/**
 * StdIO Bootstrapper
 */
async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Winky Playwright Server established on stdio buffer.");
}

// Automatically start if executed directly
if (require.main === module) {
  startMcpServer().catch((error) => {
    console.error(`[MCP] Fatal boot error: ${error}`);
    process.exit(1);
  });
}

// Graceful closures
process.on("SIGINT", async () => {
  if (globalContext) {
    await saveStorageState(globalContext, config.storageStatePath);
    await globalContext.close();
  }
  process.exit(0);
});
