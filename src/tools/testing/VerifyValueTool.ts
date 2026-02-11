import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const VerifyValueSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
  expectedValue: z.string().describe("Expected value"),
});

/**
 * browser_verify_value - Verify element value (input, checkbox)
 */
export default class VerifyValueTool extends BaseTool {
  readonly name = "browser_verify_value";
  readonly description = "Verify element value (input, checkbox, etc.)";
  readonly parameters = VerifyValueSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, expectedValue } = params as z.infer<typeof VerifyValueSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    // Try to get input value first
    let actualValue: string | null = null;
    try {
      actualValue = await locator.inputValue();
    } catch {
      // If not an input, try to get text content
      actualValue = await locator.textContent();
    }

    const matches = actualValue === expectedValue;

    return {
      success: matches,
      data: {
        ref,
        expectedValue,
        actualValue,
        matches,
      },
      error: matches
        ? undefined
        : `Expected "${expectedValue}" but got "${actualValue}"`,
    };
  }
}
