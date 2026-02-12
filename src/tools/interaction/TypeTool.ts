import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";
import { humanBehavior } from "../../utils/HumanBehavior.js";

const TypeSchema = z.object({
  ref: z.string().describe("Element reference/selector"),
  text: z.string().describe("Text to type"),
  delay: z
    .number()
    .min(0)
    .default(0)
    .describe("Delay in ms between keystrokes (0 = human-like random)"),
  submit: z.boolean().default(false).describe("Press Enter after typing"),
});

/**
 * browser_type - Type text into editable element
 */
export default class TypeTool extends BaseTool {
  readonly name = "browser_type";
  readonly description =
    "Type text into editable element (supports slow typing, submit)";
  readonly parameters = TypeSchema;
  readonly readOnly = false;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { ref, text, delay, submit } = params as z.infer<typeof TypeSchema>;

    const page = await context.pageManager.getCurrentPage();
    const typeFirstStrategies = [
      () => page.getByRole("textbox", { name: ref, exact: true }),
      () => page.getByRole("searchbox", { name: ref, exact: true }),
      () => page.getByRole("combobox", { name: ref, exact: true }),
      () => page.getByLabel(ref),
      () => page.getByPlaceholder(ref),
    ];

    let locator: any = null;
    for (const buildLocator of typeFirstStrategies) {
      const candidate = buildLocator();
      if ((await candidate.count()) > 0) {
        locator = candidate.first();
        break;
      }
    }

    if (!locator) {
      throw new Error(
        `No editable element found for ref '${ref}'. Use an exact accessible name from ax-tree/snapshot (for example the combobox name) and try again.`,
      );
    }

    const editableInfo = await locator.evaluate((el: any) => {
      const node = el as any;
      const tagName = node.tagName.toLowerCase();
      const role = node.getAttribute("role") || "";
      const contentEditable = !!node.isContentEditable;

      const isTextInput =
        tagName === "textarea" ||
        (tagName === "input" &&
          ![
            "button",
            "submit",
            "reset",
            "checkbox",
            "radio",
            "file",
            "image",
            "range",
            "color",
          ].includes(node.type || "text"));

      const isAriaEditableRole = ["textbox", "searchbox", "combobox"].includes(
        role,
      );

      return {
        tagName,
        role,
        isEditable: contentEditable || isTextInput || isAriaEditableRole,
      };
    });

    if (!editableInfo.isEditable) {
      throw new Error(
        `Ref '${ref}' matched a non-editable element (tag=${editableInfo.tagName}, role=${editableInfo.role || "none"}). Select a textbox/searchbox/combobox or input field before typing.`,
      );
    }

    // Clear existing content first
    await locator.click();
    await locator.fill("");

    // Use human-like typing if delay is 0 (default)
    if (delay === 0) {
      // Human-like typing with random delays (50-150ms per character)
      for (const char of text) {
        await humanBehavior.randomDelay(50, 150);
        await locator.pressSequentially(char);
      }
    } else {
      // Use specified delay
      await locator.pressSequentially(text, { delay });
    }

    if (submit) {
      await locator.press("Enter");
    }

    return {
      success: true,
      data: {
        ref,
        text,
        submitted: submit,
      },
    };
  }
}
