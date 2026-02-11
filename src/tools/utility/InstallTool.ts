import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const execAsync = promisify(exec);

const InstallSchema = z.object({
  browser: z
    .enum(["chromium", "firefox", "webkit"])
    .describe("Browser to install"),
});

/**
 * browser_install - Install configured browser
 * Note: Only works with full Playwright, not playwright-core
 */
export default class InstallTool extends BaseTool {
  readonly name = "browser_install";
  readonly description =
    "Install configured browser (requires full Playwright)";
  readonly parameters = InstallSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    _context: ToolContext,
  ): Promise<ToolResult> {
    const { browser } = params as z.infer<typeof InstallSchema>;

    try {
      const { stdout, stderr } = await execAsync(
        `npx playwright install ${browser}`,
      );

      return {
        success: true,
        data: {
          browser,
          stdout,
          stderr,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Browser installation failed: ${errorMsg}`,
      };
    }
  }
}
