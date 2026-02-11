import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const NavigateBackSchema = z.object({});

/**
 * browser_navigate_back - Go back in history
 */
export default class NavigateBackTool extends BaseTool {
  readonly name = "browser_navigate_back";
  readonly description = "Go back to the previous page in the history";
  readonly parameters = NavigateBackSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const page = await context.pageManager.getCurrentPage();
    await page.goBack({ waitUntil: "domcontentloaded" });

    return {
      success: true,
      data: {
        url: page.url(),
        title: await page.title(),
      },
    };
  }
}
