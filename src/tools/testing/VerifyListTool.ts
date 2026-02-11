import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const VerifyListSchema = z.object({
  role: z.string().describe("ARIA role of list"),
  name: z.string().describe("Accessible name of list"),
  items: z.array(z.string()).describe("Expected item texts"),
});

/**
 * browser_verify_list_visible - Verify list and its items visible
 */
export default class VerifyListTool extends BaseTool {
  readonly name = "browser_verify_list_visible";
  readonly description = "Verify list and its items visible";
  readonly parameters = VerifyListSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { role, name, items } = params as z.infer<typeof VerifyListSchema>;

    const page = await context.pageManager.getCurrentPage();
    const listLocator = page.getByRole(role as any, { name });

    const isListVisible = await listLocator.isVisible();
    if (!isListVisible) {
      return {
        success: false,
        error: `List with role="${role}" and name="${name}" is not visible`,
      };
    }

    const missingItems: string[] = [];
    for (const item of items) {
      const itemLocator = listLocator.getByText(item);
      const isItemVisible = await itemLocator.isVisible();
      if (!isItemVisible) {
        missingItems.push(item);
      }
    }

    const success = missingItems.length === 0;

    return {
      success,
      data: {
        role,
        name,
        items,
        missingItems,
      },
      error: success ? undefined : `Missing items: ${missingItems.join(", ")}`,
    };
  }
}
