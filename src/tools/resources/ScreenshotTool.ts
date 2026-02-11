import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const ScreenshotSchema = z.object({
  type: z
    .enum(["full", "viewport", "element"])
    .default("viewport")
    .describe("Screenshot type"),
  ref: z
    .string()
    .optional()
    .describe("Element reference (required if type=element)"),
  path: z.string().describe("Absolute path to save screenshot"),
});

/**
 * browser_take_screenshot - Take screenshot
 */
export default class ScreenshotTool extends BaseTool {
  readonly name = "browser_take_screenshot";
  readonly description = "Screenshot (full page, viewport, or element)";
  readonly parameters = ScreenshotSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { type, ref, path } = params as z.infer<typeof ScreenshotSchema>;

    const page = await context.pageManager.getCurrentPage();

    if (type === "element") {
      if (!ref) {
        throw new Error("ref is required when type=element");
      }
      const locator = page.locator(ref);
      await locator.screenshot({ path });
    } else {
      await page.screenshot({
        path,
        fullPage: type === "full",
      });
    }

    return {
      success: true,
      data: {
        type,
        path,
        ref,
      },
    };
  }
}
