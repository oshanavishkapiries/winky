import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const HandleDialogSchema = z.object({
  action: z.enum(["accept", "dismiss"]).describe("Action to take on dialog"),
  promptText: z.string().optional().describe("Text to enter in prompt dialog"),
});

/**
 * browser_handle_dialog - Accept/dismiss browser dialogs
 */
export default class HandleDialogTool extends BaseTool {
  readonly name = "browser_handle_dialog";
  readonly description =
    "Accept/dismiss browser dialogs (alert, confirm, prompt)";
  readonly parameters = HandleDialogSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { action, promptText } = params as z.infer<typeof HandleDialogSchema>;

    const page = await context.pageManager.getCurrentPage();

    // Set up dialog handler
    return new Promise((resolve) => {
      page.once("dialog", async (dialog) => {
        const dialogType = dialog.type();
        const message = dialog.message();

        if (action === "accept") {
          await dialog.accept(promptText);
        } else {
          await dialog.dismiss();
        }

        resolve({
          success: true,
          data: {
            action,
            dialogType,
            message,
            promptText,
          },
        });
      });

      // Set a timeout in case no dialog appears
      setTimeout(() => {
        resolve({
          success: false,
          error: "No dialog appeared within timeout",
        });
      }, 5000);
    });
  }
}
