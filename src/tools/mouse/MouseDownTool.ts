import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseDownSchema = z.object({
  button: z
    .enum(["left", "right", "middle"])
    .default("left")
    .describe("Mouse button"),
});

/**
 * browser_mouse_down - Press mouse button down
 */
export default class MouseDownTool extends BaseTool {
  readonly name = "browser_mouse_down";
  readonly description = "Press mouse button down";
  readonly parameters = MouseDownSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { button } = params as z.infer<typeof MouseDownSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.down({ button });

    return {
      success: true,
      data: { button },
    };
  }
}
