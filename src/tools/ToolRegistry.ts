import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLogger } from "../logger/Logger.js";
import { ToolError } from "../utils/errors.js";
import type { ITool } from "./ITool.js";

/**
 * ToolRegistry - Auto-discovers and registers all tools
 * Implements Registry Pattern with auto-discovery
 */
export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();
  private logger = getLogger();

  /**
   * Auto-discover and register all tools from subdirectories
   */
  async initialize(): Promise<void> {
    const toolsDir = resolve(import.meta.dirname, ".");
    const categories = [
      "navigation",
      "interaction",
      "resources",
      "utility",
      "testing",
      "mouse",
    ];

    this.logger.browser("info", "Discovering tools...");

    for (const category of categories) {
      const categoryPath = join(toolsDir, category);

      try {
        const files = readdirSync(categoryPath);

        for (const file of files) {
          if (file.endsWith(".ts") || file.endsWith(".js")) {
            await this.loadTool(join(categoryPath, file), category);
          }
        }
      } catch (error) {
        // Category directory doesn't exist yet - skip
        this.logger.browser("info", `Category ${category} not found, skipping`);
      }
    }

    this.logger.browser("info", `Registered ${this.tools.size} tools`, {
      tools: Array.from(this.tools.keys()),
    });
  }

  /**
   * Load a single tool from a file
   */
  private async loadTool(filePath: string, category: string): Promise<void> {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

      // Look for default export or named export matching the file name
      const ToolClass =
        module.default ||
        Object.values(module).find(
          (exp): exp is new () => ITool => typeof exp === "function",
        );

      if (!ToolClass) {
        this.logger.browser("warn", `No tool class found in ${filePath}`);
        return;
      }

      const tool = new (ToolClass as new () => ITool)();

      if (this.tools.has(tool.name)) {
        this.logger.browser("warn", `Duplicate tool name: ${tool.name}`, {
          filePath,
        });
        return;
      }

      this.tools.set(tool.name, tool);
      this.logger.browser("info", `Registered tool: ${tool.name}`, {
        category,
      });
    } catch (error) {
      this.logger.browser("error", `Failed to load tool from ${filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ITool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Tool not found: ${name}`);
    }
    return tool;
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tools
   */
  listTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names by category
   */
  getToolsByCategory(category: string): ITool[] {
    // Tools are named with category prefix (e.g., "browser_navigate")
    return this.listTools().filter((tool) =>
      tool.name.startsWith(`browser_${category}`),
    );
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
}
