import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const VerifyElementSchema = z.object({
  role: z.string().describe("ARIA role of element"),
  name: z.string().describe("Accessible name of element"),
});

/**
 * browser_verify_element_visible - Verify element visible by role + name
 */
export default class VerifyElementTool extends BaseTool {
  readonly name = "browser_verify_element_visible";
  readonly description = "Verify element visible by role and name";
  readonly parameters = VerifyElementSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { role, name } = params as z.infer<typeof VerifyElementSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.getByRole(role as any, { name });

    const isVisible = await locator.isVisible();

    return {
      success: isVisible,
      data: {
        role,
        name,
        isVisible,
      },
      error: isVisible
        ? undefined
        : `Element with role="${role}" and name="${name}" is not visible`,
    };
  }
}
