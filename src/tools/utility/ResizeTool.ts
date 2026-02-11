import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const ResizeSchema = z.object({
  width: z.number().int().min(1).describe("Viewport width in pixels"),
  height: z.number().int().min(1).describe("Viewport height in pixels"),
});

/**
 * browser_resize - Resize browser window
 */
export default class ResizeTool extends BaseTool {
  readonly name = "browser_resize";
  readonly description = "Resize browser viewport";
  readonly parameters = ResizeSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { width, height } = params as z.infer<typeof ResizeSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.setViewportSize({ width, height });

    return {
      success: true,
      data: {
        width,
        height,
      },
    };
  }
}
