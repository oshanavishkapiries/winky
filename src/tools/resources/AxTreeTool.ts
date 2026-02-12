import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const AxTreeSchema = z.object({
  interestingOnly: z
    .boolean()
    .default(true)
    .describe("Filter out uninteresting nodes (default: true)"),
  root: z
    .string()
    .optional()
    .describe("CSS selector to scope the tree to a specific element"),
});

/**
 * browser_ax_tree - Get real accessibility tree using Playwright's accessibility API
 * Returns the full accessibility tree structure as seen by assistive technologies
 */
export default class AxTreeTool extends BaseTool {
  readonly name = "browser_ax_tree";
  readonly description =
    "Get the real accessibility tree (ax-tree) of the page using Playwright's accessibility API. Returns the full tree structure with roles, names, states, and hierarchy. Use this to understand page structure, verify accessibility, or debug complex navigation. For quick element lookup, use browser_snapshot instead.";
  readonly parameters = AxTreeSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { interestingOnly, root } = params as z.infer<typeof AxTreeSchema>;

    const page = await context.pageManager.getCurrentPage();

    // Get page metadata
    const title = await page.title();
    const url = page.url();

    // Get the accessibility snapshot
    // Note: accessibility API exists at runtime but not in playwright-core types
    const pageWithAccessibility = page as any;

    try {
      // Check if accessibility API is available
      if (
        !pageWithAccessibility.accessibility ||
        typeof pageWithAccessibility.accessibility.snapshot !== "function"
      ) {
        this.logger.tool(
          "warn",
          "Accessibility API not available, falling back to snapshot",
        );
        return {
          success: false,
          error:
            "Accessibility API not available on this browser. Use browser_snapshot instead.",
        };
      }

      const snapshot = await pageWithAccessibility.accessibility.snapshot({
        interestingOnly,
        ...(root && { root: await page.locator(root).elementHandle() }),
      });

      if (!snapshot) {
        return {
          success: false,
          error: "Failed to capture accessibility tree (page may be empty)",
        };
      }

      // Format the tree into readable text
      const formattedTree = this.formatAxTree(snapshot);

      return {
        success: true,
        data: {
          url,
          title,
          tree: formattedTree,
          raw: snapshot,
          instructions:
            "The tree shows the accessibility structure with roles, names, and states. Use this to understand page hierarchy and element relationships.",
        },
      };
    } catch (error) {
      this.logger.tool("error", "Accessibility snapshot failed", { error });
      return {
        success: false,
        error: `Accessibility API error: ${error instanceof Error ? error.message : String(error)}. Use browser_snapshot instead.`,
      };
    }
  }

  /**
   * Recursively format the accessibility tree into readable indented text
   */
  private formatAxTree(
    node: any,
    indent: number = 0,
    result: string[] = [],
  ): string {
    const prefix = "  ".repeat(indent);

    // Build node description
    let nodeDesc = `${prefix}${node.role}`;

    if (node.name) {
      nodeDesc += ` "${node.name}"`;
    }

    if (node.value) {
      nodeDesc += ` value="${node.value}"`;
    }

    // Add states
    const states: string[] = [];
    if (node.checked !== undefined) states.push(`checked=${node.checked}`);
    if (node.disabled) states.push("disabled");
    if (node.expanded !== undefined) states.push(`expanded=${node.expanded}`);
    if (node.focused) states.push("focused");
    if (node.modal) states.push("modal");
    if (node.multiline) states.push("multiline");
    if (node.multiselectable) states.push("multiselectable");
    if (node.readonly) states.push("readonly");
    if (node.required) states.push("required");
    if (node.selected !== undefined) states.push(`selected=${node.selected}`);

    if (states.length > 0) {
      nodeDesc += ` [${states.join(", ")}]`;
    }

    if (node.description) {
      nodeDesc += ` (${node.description})`;
    }

    result.push(nodeDesc);

    // Recursively format children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.formatAxTree(child, indent + 1, result);
      }
    }

    return result.join("\n");
  }
}
