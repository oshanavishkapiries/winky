import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const CloseSchema = z.object({});

/**
 * browser_close - Close the current page
 */
export default class CloseTool extends BaseTool {
  readonly name = "browser_close";
  readonly description = "Close the current page";
  readonly parameters = CloseSchema;
  readonly readOnly = false;

  protected async executeImpl(
    _params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const page = await context.pageManager.getCurrentPage();
    const url = page.url();

    await page.close();

    return {
      success: true,
      data: {
        closedUrl: url,
      },
    };
  }
}
