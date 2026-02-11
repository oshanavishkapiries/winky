import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const DragSchema = z.object({
  sourceRef: z.string().describe("Source element reference/selector"),
  targetRef: z.string().describe("Target element reference/selector"),
});

/**
 * browser_drag - Drag and drop between elements
 */
export default class DragTool extends BaseTool {
  readonly name = "browser_drag";
  readonly description = "Drag and drop between elements";
  readonly parameters = DragSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { sourceRef, targetRef } = params as z.infer<typeof DragSchema>;

    const page = await context.pageManager.getCurrentPage();

    await page.dragAndDrop(sourceRef, targetRef);

    return {
      success: true,
      data: {
        sourceRef,
        targetRef,
      },
    };
  }
}
