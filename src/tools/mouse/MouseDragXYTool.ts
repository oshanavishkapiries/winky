import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseDragXYSchema = z.object({
  startX: z.number().describe("Start X coordinate"),
  startY: z.number().describe("Start Y coordinate"),
  endX: z.number().describe("End X coordinate"),
  endY: z.number().describe("End Y coordinate"),
});

/**
 * browser_mouse_drag_xy - Drag from start to end coordinates
 */
export default class MouseDragXYTool extends BaseTool {
  readonly name = "browser_mouse_drag_xy";
  readonly description = "Drag from start to end coordinates";
  readonly parameters = MouseDragXYSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { startX, startY, endX, endY } = params as z.infer<
      typeof MouseDragXYSchema
    >;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    return {
      success: true,
      data: {
        startX,
        startY,
        endX,
        endY,
      },
    };
  }
}
