import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const GenerateLocatorSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
});

/**
 * browser_generate_locator - Generate Playwright locator for element
 */
export default class GenerateLocatorTool extends BaseTool {
  readonly name = "browser_generate_locator";
  readonly description = "Generate Playwright locator code for element";
  readonly parameters = GenerateLocatorSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref } = params as z.infer<typeof GenerateLocatorSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    // Get element info to generate better locator
    const role = await locator.getAttribute("role").catch(() => null);
    const ariaLabel = await locator
      .getAttribute("aria-label")
      .catch(() => null);
    const text = await locator.textContent().catch(() => null);

    let suggestedLocator = `page.locator('${ref}')`;

    if (role && ariaLabel) {
      suggestedLocator = `page.getByRole('${role}', { name: '${ariaLabel}' })`;
    } else if (text) {
      suggestedLocator = `page.getByText('${text.trim()}')`;
    }

    return {
      success: true,
      data: {
        ref,
        suggestedLocator,
        role,
        ariaLabel,
        text: text?.trim(),
      },
    };
  }
}
