import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const ConsoleMessagesSchema = z.object({
  level: z
    .enum(["log", "warn", "error", "info", "debug"])
    .optional()
    .describe("Filter by console level"),
});

/**
 * browser_console_messages - Retrieve console logs
 */
export default class ConsoleMessagesTool extends BaseTool {
  readonly name = "browser_console_messages";
  readonly description = "Retrieve console logs by level";
  readonly parameters = ConsoleMessagesSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { level } = params as z.infer<typeof ConsoleMessagesSchema>;

    const messages = context.pageManager.getConsoleMessages(level);

    return {
      success: true,
      data: {
        messages,
        count: messages.length,
        level: level || "all",
      },
    };
  }
}
