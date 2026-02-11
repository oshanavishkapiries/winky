import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const MouseUpSchema = z.object({
  button: z
    .enum(["left", "right", "middle"])
    .default("left")
    .describe("Mouse button"),
});

/**
 * browser_mouse_up - Release mouse button
 */
export default class MouseUpTool extends BaseTool {
  readonly name = "browser_mouse_up";
  readonly description = "Release mouse button";
  readonly parameters = MouseUpSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { button } = params as z.infer<typeof MouseUpSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.mouse.up({ button });

    return {
      success: true,
      data: { button },
    };
  }
}
