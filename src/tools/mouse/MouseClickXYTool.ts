import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseClickXYSchema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  button: z
    .enum(["left", "right", "middle"])
    .default("left")
    .describe("Mouse button"),
  clickCount: z.number().int().min(1).max(3).default(1).describe("Click count"),
});

/**
 * browser_mouse_click_xy - Click at x,y coordinates
 */
export default class MouseClickXYTool extends BaseTool {
  readonly name = "browser_mouse_click_xy";
  readonly description = "Click at x,y coordinates";
  readonly parameters = MouseClickXYSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { x, y, button, clickCount } = params as z.infer<
      typeof MouseClickXYSchema
    >;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.click(x, y, { button, clickCount });

    return {
      success: true,
      data: {
        x,
        y,
        button,
        clickCount,
      },
    };
  }
}
