import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const WaitForSchema = z.object({
  type: z.enum(["text", "time", "selector"]).describe("What to wait for"),
  value: z
    .union([z.string(), z.number()])
    .describe("Text/selector string or time in ms"),
  timeout: z.number().default(30000).describe("Timeout in ms"),
});

/**
 * browser_wait_for - Wait for text/time/condition
 */
export default class WaitForTool extends BaseTool {
  readonly name = "browser_wait_for";
  readonly description = "Wait for text/time/selector/condition";
  readonly parameters = WaitForSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { type, value, timeout } = params as z.infer<typeof WaitForSchema>;

    const page = await context.pageManager.getCurrentPage();

    if (type === "time") {
      const ms =
        typeof value === "number" ? value : parseInt(String(value), 10);
      await page.waitForTimeout(ms);
    } else if (type === "selector") {
      await page.waitForSelector(String(value), { timeout });
    } else if (type === "text") {
      await page.getByText(String(value)).waitFor({ timeout });
    }

    return {
      success: true,
      data: {
        type,
        value,
        timeout,
      },
    };
  }
}
