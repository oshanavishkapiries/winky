import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseWheelSchema = z.object({
  deltaX: z.number().default(0).describe("Horizontal scroll amount"),
  deltaY: z.number().describe("Vertical scroll amount"),
});

/**
 * browser_mouse_wheel - Scroll mouse wheel
 */
export default class MouseWheelTool extends BaseTool {
  readonly name = "browser_mouse_wheel";
  readonly description = "Scroll mouse wheel";
  readonly parameters = MouseWheelSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { deltaX, deltaY } = params as z.infer<typeof MouseWheelSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.wheel(deltaX, deltaY);

    return {
      success: true,
      data: {
        deltaX,
        deltaY,
      },
    };
  }
}
