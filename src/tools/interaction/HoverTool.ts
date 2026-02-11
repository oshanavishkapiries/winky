import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const HoverSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
});

/**
 * browser_hover - Hover over element
 */
export default class HoverTool extends BaseTool {
  readonly name = "browser_hover";
  readonly description = "Hover over element";
  readonly parameters = HoverSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref } = params as z.infer<typeof HoverSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    await locator.hover();

    return {
      success: true,
      data: { ref },
    };
  }
}
