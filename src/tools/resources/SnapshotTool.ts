import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const SnapshotSchema = z.object({
  includeHidden: z.boolean().default(false).describe("Include hidden elements"),
});

/**
 * browser_snapshot - Capture accessibility tree snapshot
 */
export default class SnapshotTool extends BaseTool {
  readonly name = "browser_snapshot";
  readonly description =
    "Capture accessibility tree snapshot (structured page content)";
  readonly parameters = SnapshotSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { includeHidden } = params as z.infer<typeof SnapshotSchema>;

    const page = await context.pageManager.getCurrentPage();

    // Get page snapshot using Playwright's built-in content methods
    const content = await page.content();
    const title = await page.title();
    const url = page.url();

    // Get all interactive elements
    const elements = await page.evaluate(() => {
      const result: any[] = [];
      const selectors = [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[role]",
      ];

      selectors.forEach((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document
          .querySelectorAll(selector)
          .forEach((el: any) => {
            const rect = el.getBoundingClientRect();
            result.push({
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute("role") || el.tagName.toLowerCase(),
              name:
                el.getAttribute("aria-label") ||
                el.textContent?.substring(0, 50) ||
                "",
              visible: rect.width > 0 && rect.height > 0,
            });
          });
      });

      return result;
    });

    return {
      success: true,
      data: {
        snapshot: {
          elements,
          contentLength: content.length,
        },
        url,
        title,
        includeHidden,
      },
    };
  }
}
