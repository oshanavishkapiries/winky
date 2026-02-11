import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const EvaluateSchema = z.object({
  code: z.string().describe("JavaScript code to execute"),
  ref: z
    .string()
    .optional()
    .describe("Element reference (execute on element if provided)"),
});

/**
 * browser_evaluate - Execute JavaScript on page or element
 */
export default class EvaluateTool extends BaseTool {
  readonly name = "browser_evaluate";
  readonly description = "Execute JavaScript on page or element";
  readonly parameters = EvaluateSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { code, ref } = params as z.infer<typeof EvaluateSchema>;

    const page = await context.pageManager.getCurrentPage();

    let result;
    if (ref) {
      const locator = page.locator(ref);
      result = await locator.evaluate((_el, code) => {
        // eslint-disable-next-line no-eval
        return eval(code);
      }, code);
    } else {
      result = await page.evaluate((code) => {
        // eslint-disable-next-line no-eval
        return eval(code);
      }, code);
    }

    return {
      success: true,
      data: {
        result,
        code,
        ref,
      },
    };
  }
}
