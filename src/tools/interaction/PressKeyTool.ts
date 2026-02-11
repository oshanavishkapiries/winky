import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const PressKeySchema = z.object({
  key: z
    .string()
    .describe("Key to press (e.g., 'Enter', 'Escape', 'ArrowDown')"),
});

/**
 * browser_press_key - Press keyboard key
 */
export default class PressKeyTool extends BaseTool {
  readonly name = "browser_press_key";
  readonly description = "Press keyboard key";
  readonly parameters = PressKeySchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { key } = params as z.infer<typeof PressKeySchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.keyboard.press(key);

    return {
      success: true,
      data: { key },
    };
  }
}
