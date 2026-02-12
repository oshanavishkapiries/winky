import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";
import { humanBehavior } from "../../utils/HumanBehavior.js";

const ClickSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
  clickCount: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1)
    .describe("1=single, 2=double, 3=triple"),
  button: z
    .enum(["left", "right", "middle"])
    .default("left")
    .describe("Mouse button"),
  modifiers: z
    .array(z.enum(["Alt", "Control", "Meta", "Shift"]))
    .optional()
    .describe("Keyboard modifiers"),
});

/**
 * browser_click - Click element by reference
 */
export default class ClickTool extends BaseTool {
  readonly name = "browser_click";
  readonly description =
    "Click element by accessibility ref (supports double-click, modifiers)";
  readonly parameters = ClickSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, clickCount, button, modifiers } = params as z.infer<
      typeof ClickSchema
    >;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    // Add human-like delay before clicking
    await humanBehavior.randomDelay(100, 300);

    await locator.click({
      clickCount,
      button,
      modifiers,
    });

    return {
      success: true,
      data: {
        ref,
        clickCount,
        button,
      },
    };
  }
}
