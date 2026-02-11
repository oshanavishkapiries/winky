import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const TabsSchema = z.object({
  action: z.enum(["list", "create", "close", "select"]),
  index: z.number().int().nonnegative().optional(),
});

/**
 * browser_tabs - Manage tabs (list, create, close, select)
 */
export default class TabsTool extends BaseTool {
  readonly name = "browser_tabs";
  readonly description = "List, create, close, or select a browser tab";
  readonly parameters = TabsSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { action, index } = params as z.infer<typeof TabsSchema>;

    switch (action) {
      case "list": {
        const tabs = context.pageManager.listTabs();
        const tabInfo = await Promise.all(
          tabs.map(async (tab, i) => ({
            index: i,
            url: tab.url(),
            title: await tab.title(),
          })),
        );

        return {
          success: true,
          data: { tabs: tabInfo, count: tabs.length },
        };
      }

      case "create": {
        const newPage = await context.pageManager.createTab();
        return {
          success: true,
          data: {
            url: newPage.url(),
            tabCount: context.pageManager.getTabCount(),
          },
        };
      }

      case "close": {
        await context.pageManager.closeTab(index);
        return {
          success: true,
          data: { tabCount: context.pageManager.getTabCount() },
        };
      }

      case "select": {
        if (index === undefined) {
          return {
            success: false,
            error: "index is required for select action",
          };
        }

        const page = await context.pageManager.switchToTab(index);
        return {
          success: true,
          data: {
            index,
            url: page.url(),
            title: await page.title(),
          },
        };
      }
    }
  }
}
