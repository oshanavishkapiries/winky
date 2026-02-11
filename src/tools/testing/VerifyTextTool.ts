import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const VerifyTextSchema = z.object({
  text: z.string().describe("Text to verify is visible"),
});

/**
 * browser_verify_text_visible - Verify text visible on page
 */
export default class VerifyTextTool extends BaseTool {
  readonly name = "browser_verify_text_visible";
  readonly description = "Verify text visible on page";
  readonly parameters = VerifyTextSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { text } = params as z.infer<typeof VerifyTextSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.getByText(text);

    const isVisible = await locator.isVisible();

    return {
      success: isVisible,
      data: {
        text,
        isVisible,
      },
      error: isVisible ? undefined : `Text "${text}" is not visible on page`,
    };
  }
}
