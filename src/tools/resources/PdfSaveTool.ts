import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const PdfSaveSchema = z.object({
  path: z.string().describe("Absolute path to save PDF"),
  format: z.enum(["A4", "Letter"]).default("A4").describe("Paper format"),
  landscape: z.boolean().default(false).describe("Landscape orientation"),
});

/**
 * browser_pdf_save - Save page as PDF
 */
export default class PdfSaveTool extends BaseTool {
  readonly name = "browser_pdf_save";
  readonly description = "Save page as PDF";
  readonly parameters = PdfSaveSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { path, format, landscape } = params as z.infer<typeof PdfSaveSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.pdf({
      path,
      format,
      landscape,
    });

    return {
      success: true,
      data: {
        path,
        format,
        landscape,
      },
    };
  }
}
