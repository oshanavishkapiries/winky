import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const TypeSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
  text: z.string().describe("Text to type"),
  delay: z
    .number()
    .min(0)
    .default(0)
    .describe("Delay in ms between keystrokes"),
  submit: z.boolean().default(false).describe("Press Enter after typing"),
});

/**
 * browser_type - Type text into editable element
 */
export default class TypeTool extends BaseTool {
  readonly name = "browser_type";
  readonly description =
    "Type text into editable element (supports slow typing, submit)";
  readonly parameters = TypeSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, text, delay, submit } = params as z.infer<typeof TypeSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    await locator.type(text, { delay });

    if (submit) {
      await locator.press("Enter");
    }

    return {
      success: true,
      data: {
        ref,
        text,
        submitted: submit,
      },
    };
  }
}
