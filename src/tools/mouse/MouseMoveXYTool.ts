import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseMoveXYSchema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  steps: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Number of interpolation steps"),
});

/**
 * browser_mouse_move_xy - Move mouse to x,y
 */
export default class MouseMoveXYTool extends BaseTool {
  readonly name = "browser_mouse_move_xy";
  readonly description = "Move mouse to x,y coordinates";
  readonly parameters = MouseMoveXYSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { x, y, steps } = params as z.infer<typeof MouseMoveXYSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.move(x, y, { steps });

    return {
      success: true,
      data: {
        x,
        y,
        steps,
      },
    };
  }
}
