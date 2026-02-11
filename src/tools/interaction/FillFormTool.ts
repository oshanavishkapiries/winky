import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const FillFormSchema = z.object({
  fields: z
    .array(
      z.object({
        ref: z.string().describe("Field reference/selector"),
        value: z.string().describe("Value to fill"),
      }),
    )
    .describe("Array of fields to fill"),
});

/**
 * browser_fill_form - Fill multiple form fields at once
 */
export default class FillFormTool extends BaseTool {
  readonly name = "browser_fill_form";
  readonly description = "Fill multiple form fields at once";
  readonly parameters = FillFormSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { fields } = params as z.infer<typeof FillFormSchema>;

    const page = await context.pageManager.getCurrentPage();

    for (const field of fields) {
      const locator = page.locator(field.ref);
      await locator.fill(field.value);
    }

    return {
      success: true,
      data: {
        fieldsCount: fields.length,
        fields: fields.map((f) => ({ ref: f.ref, filled: true })),
      },
    };
  }
}
