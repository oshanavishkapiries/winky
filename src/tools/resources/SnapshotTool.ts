import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const SnapshotSchema = z.object({
  includeHidden: z.boolean().default(false).describe("Include hidden elements"),
});

/**
 * browser_snapshot - Capture page structure with accessible names
 * Extracts interactive elements with their accessible names for accurate clicking
 */
export default class SnapshotTool extends BaseTool {
  readonly name = "browser_snapshot";
  readonly description =
    "Get page structure showing clickable elements with their accessible names and roles. Use this before clicking to find the correct element names.";
  readonly parameters = SnapshotSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { includeHidden } = params as z.infer<typeof SnapshotSchema>;

    const page = await context.pageManager.getCurrentPage();

    // Get page metadata
    const title = await page.title();
    const url = page.url();

    // Extract interactive elements with accessible names
    const elements = await page.evaluate((showHidden) => {
      const result: any[] = [];

      // Get all potentially interactive elements
      const selectors = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "[role='button']",
        "[role='link']",
        "[role='tab']",
        "[role='menuitem']",
        "[role='navigation']",
        "[onclick]",
        "h1",
        "h2",
        "h3",
      ];

      const seen = new Set();

      selectors.forEach((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document
          .querySelectorAll(selector)
          .forEach((el: any) => {
            // Skip duplicates
            if (seen.has(el)) return;
            seen.add(el);

            // Check visibility
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;

            if (!showHidden && !isVisible) return;

            // Get accessible name (priority order for best accuracy)
            const accessibleName =
              el.getAttribute("aria-label") ||
              el.getAttribute("aria-labelledby") ||
              el.getAttribute("title") ||
              el.getAttribute("alt") ||
              el.getAttribute("placeholder") ||
              el.textContent?.trim().substring(0, 100) ||
              el.value ||
              "";

            if (!accessibleName) return; // Skip elements with no name

            // Get role (semantic or ARIA)
            const role =
              el.getAttribute("role") ||
              (el.tagName === "A"
                ? "link"
                : el.tagName === "BUTTON"
                  ? "button"
                  : el.tagName === "INPUT"
                    ? "input"
                    : el.tagName.toLowerCase());

            // Build element info
            const elementInfo: any = {
              name: accessibleName,
              role,
              tag: el.tagName.toLowerCase(),
              visible: isVisible, // Keep visible property for filtering outside
            };

            // Add optional properties
            if (el.href) elementInfo.href = el.href;
            if (el.type) elementInfo.inputType = el.type;
            if (el.value && el.tagName === "INPUT")
              elementInfo.value = el.value;

            result.push(elementInfo);
          });
      });

      return result;
    }, includeHidden);

    // Filter to visible elements only (unless includeHidden is true)
    const filteredElements = includeHidden
      ? elements
      : elements.filter((el) => el.visible !== false);

    return {
      success: true,
      data: {
        url,
        title,
        elements: filteredElements,
        totalElements: filteredElements.length,
        instructions:
          "Use the 'name' field as the 'ref' parameter when clicking elements. The 'role' field indicates the element type (link, button, input, etc.).",
      },
    };
  }
}
