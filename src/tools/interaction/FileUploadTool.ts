import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const FileUploadSchema = z.object({
  ref: z.string().describe("File input element reference/selector"),
  filePaths: z.array(z.string()).describe("Absolute paths to files to upload"),
});

/**
 * browser_file_upload - Upload file(s)
 */
export default class FileUploadTool extends BaseTool {
  readonly name = "browser_file_upload";
  readonly description = "Upload file(s) to file input element";
  readonly parameters = FileUploadSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, filePaths } = params as z.infer<typeof FileUploadSchema>;

    const page = await context.pageManager.getCurrentPage();
    const locator = page.locator(ref);

    await locator.setInputFiles(filePaths);

    return {
      success: true,
      data: {
        ref,
        filesCount: filePaths.length,
        filePaths,
      },
    };
  }
}
