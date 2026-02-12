import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

type AXPrimitive = string | number | boolean | null;

interface AXValue {
  value?: AXPrimitive;
}

interface AXProperty {
  name: string;
  value?: AXValue;
}

interface AXNode {
  nodeId: string;
  parentId?: string;
  childIds?: string[];
  role?: AXValue;
  name?: AXValue;
  value?: AXValue;
  description?: AXValue;
  properties?: AXProperty[];
  ignored?: boolean;
}

interface FormattedAXNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  ignored?: boolean;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  children?: FormattedAXNode[];
}

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

    // Old Playwright API may exist in some versions, but recent versions require CDP.
    const pageWithAccessibility = page as any;

    try {
      let treeRoot: FormattedAXNode | null = null;

      // Compatibility path for older Playwright versions.
      if (
        pageWithAccessibility.accessibility &&
        typeof pageWithAccessibility.accessibility.snapshot === "function"
      ) {
        const snapshot = await pageWithAccessibility.accessibility.snapshot({
          interestingOnly,
          ...(root && { root: await page.locator(root).elementHandle() }),
        });

        if (snapshot) {
          treeRoot = snapshot as FormattedAXNode;
        }
      }

      // Main path for Playwright v1.58+: use Chromium CDP Accessibility domain.
      if (!treeRoot) {
        treeRoot = await this.captureViaCDP(context, page, root);
      }

      if (!treeRoot) {
        return {
          success: false,
          error: "Failed to capture accessibility tree (empty result)",
        };
      }

      const formattedTree = this.formatAxTree(treeRoot, 0, [], interestingOnly);

      return {
        success: true,
        data: {
          url,
          title,
          tree: formattedTree,
          raw: treeRoot,
          instructions:
            "The tree shows the accessibility structure with roles, names, and states. Use this to understand page hierarchy and element relationships.",
        },
      };
    } catch (error) {
      this.logger.tool("error", "Accessibility snapshot failed", { error });
      return {
        success: false,
        error: `Accessibility API error: ${error instanceof Error ? error.message : String(error)}.`,
      };
    }
  }

  /**
   * Capture accessibility tree using Chromium CDP commands.
   */
  private async captureViaCDP(
    context: ToolContext,
    page: unknown,
    rootSelector?: string,
  ): Promise<FormattedAXNode | null> {
    const browserContextAny = context.browserManager.getContext() as any;

    if (typeof browserContextAny.newCDPSession !== "function") {
      throw new Error(
        "CDP session is not available on this browser context (requires Chromium).",
      );
    }

    const cdp = await browserContextAny.newCDPSession(page as any);

    try {
      await cdp.send("Accessibility.enable");

      let nodes: AXNode[] = [];

      if (rootSelector) {
        const doc = await cdp.send("DOM.getDocument", { depth: 1 });
        const query = await cdp.send("DOM.querySelector", {
          nodeId: doc.root.nodeId,
          selector: rootSelector,
        });

        if (!query.nodeId) {
          throw new Error(`Root selector not found: ${rootSelector}`);
        }

        const described = await cdp.send("DOM.describeNode", {
          nodeId: query.nodeId,
        });

        const partial = await cdp.send("Accessibility.getPartialAXTree", {
          backendNodeId: described.node.backendNodeId,
          fetchRelatives: true,
        });

        nodes = (partial.nodes || []) as AXNode[];
      } else {
        const full = await cdp.send("Accessibility.getFullAXTree");
        nodes = (full.nodes || []) as AXNode[];
      }

      return this.buildTreeFromAXNodes(nodes);
    } finally {
      await cdp.send("Accessibility.disable").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    }
  }

  /**
   * Convert flat CDP AX nodes into hierarchical tree.
   */
  private buildTreeFromAXNodes(nodes: AXNode[]): FormattedAXNode | null {
    if (nodes.length === 0) {
      return null;
    }

    const byId = new Map<string, AXNode>();
    for (const node of nodes) {
      byId.set(node.nodeId, node);
    }

    const childIds = new Set<string>();
    for (const node of nodes) {
      for (const childId of node.childIds || []) {
        childIds.add(childId);
      }
    }

    const rootNode =
      nodes.find((n) => !childIds.has(n.nodeId)) ||
      nodes.find((n) => this.axValueToString(n.role) === "RootWebArea") ||
      nodes[0];

    const toFormatted = (nodeId: string): FormattedAXNode | null => {
      const node = byId.get(nodeId);
      if (!node) return null;

      const properties = this.extractStateProperties(node.properties || []);
      const formatted: FormattedAXNode = {
        role: this.axValueToString(node.role) || "unknown",
        name: this.axValueToString(node.name) || undefined,
        value: this.axValueToString(node.value) || undefined,
        description: this.axValueToString(node.description) || undefined,
        ignored: !!node.ignored,
        ...properties,
      };

      const children: FormattedAXNode[] = [];
      for (const childId of node.childIds || []) {
        const child = toFormatted(childId);
        if (child) children.push(child);
      }

      if (children.length > 0) {
        formatted.children = children;
      }

      return formatted;
    };

    return toFormatted(rootNode.nodeId);
  }

  private axValueToString(value?: AXValue): string {
    if (!value || value.value === undefined || value.value === null) return "";
    return String(value.value);
  }

  private extractStateProperties(
    properties: AXProperty[],
  ): Partial<FormattedAXNode> {
    const out: Partial<FormattedAXNode> = {};

    const asBool = (name: string): boolean | undefined => {
      const prop = properties.find((p) => p.name === name);
      if (!prop || !prop.value) return undefined;
      if (typeof prop.value.value === "boolean") return prop.value.value;
      if (typeof prop.value.value === "string") {
        if (prop.value.value === "true") return true;
        if (prop.value.value === "false") return false;
      }
      return undefined;
    };

    out.checked = asBool("checked");
    out.disabled = asBool("disabled");
    out.expanded = asBool("expanded");
    out.focused = asBool("focused");
    out.modal = asBool("modal");
    out.multiline = asBool("multiline");
    out.multiselectable = asBool("multiselectable");
    out.readonly = asBool("readonly");
    out.required = asBool("required");
    out.selected = asBool("selected");

    return out;
  }

  /**
   * Recursively format the accessibility tree into readable indented text
   */
  private formatAxTree(
    node: FormattedAXNode,
    indent: number = 0,
    result: string[] = [],
    interestingOnly: boolean = false,
  ): string {
    if (interestingOnly && node.ignored) {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          this.formatAxTree(child, indent, result, interestingOnly);
        }
      }
      return result.join("\n");
    }

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
        this.formatAxTree(child, indent + 1, result, interestingOnly);
      }
    }

    return result.join("\n");
  }
}
