import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const SelectOptionSchema = z.object({
  ref: z.string().describe("Select element reference/selector"),
  values: z.array(z.string()).describe("Option values to select"),
});

/**
 * browser_select_option - Select dropdown option(s)
 */
export default class SelectOptionTool extends BaseTool {
  readonly name = "browser_select_option";
  readonly description = "Select dropdown option(s)";
  readonly parameters = SelectOptionSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, values } = params as z.infer<typeof SelectOptionSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    await locator.selectOption(values);

    return {
      success: true,
      data: {
        ref,
        values,
      },
    };
  }
}
