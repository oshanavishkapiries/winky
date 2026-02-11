import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const RunCodeSchema = z.object({
  code: z.string().describe("Playwright code snippet to execute"),
});

/**
 * browser_run_code - Run arbitrary Playwright code snippet
 * WARNING: This is a powerful and potentially dangerous tool
 */
export default class RunCodeTool extends BaseTool {
  readonly name = "browser_run_code";
  readonly description =
    "Run arbitrary Playwright code snippet (advanced users only)";
  readonly parameters = RunCodeSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { code } = params as z.infer<typeof RunCodeSchema>;

    const page = await context.pageManager.getCurrentPage();
    const browserManager = context.browserManager;

    try {
      // Create async function with page and browserManager in scope
      const asyncFunc = new Function(
        "page",
        "browserManager",
        `return (async () => { ${code} })()`,
      );

      const result = await asyncFunc(page, browserManager);

      return {
        success: true,
        data: {
          result,
          code,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Code execution failed: ${errorMsg}`,
      };
    }
  }
}
