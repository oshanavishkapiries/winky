import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const NavigateSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

/**
 * browser_navigate - Navigate to a URL
 */
export default class NavigateTool extends BaseTool {
  readonly name = "browser_navigate";
  readonly description = "Navigate to a URL";
  readonly parameters = NavigateSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { url } = params as z.infer<typeof NavigateSchema>;

    const page = await context.pageManager.getCurrentPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    return {
      success: true,
      data: {
        url: page.url(),
        title: await page.title(),
      },
    };
  }
}
