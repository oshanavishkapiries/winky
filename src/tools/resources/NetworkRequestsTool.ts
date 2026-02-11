import { z } from "zod";
import { BaseTool } from "../BaseTool.js";
import type { ToolContext, ToolResult } from "../ITool.js";

const NetworkRequestsSchema = z.object({
  filterStatic: z
    .boolean()
    .default(true)
    .describe("Exclude static resources (images, css, js)"),
});

/**
 * browser_network_requests - List network requests
 */
export default class NetworkRequestsTool extends BaseTool {
  readonly name = "browser_network_requests";
  readonly description = "List network requests (filter static resources)";
  readonly parameters = NetworkRequestsSchema;
  readonly readOnly = true;

  protected async executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { filterStatic } = params as z.infer<typeof NetworkRequestsSchema>;

    const requests = context.pageManager.getNetworkRequests(filterStatic);

    return {
      success: true,
      data: {
        requests,
        count: requests.length,
        filterStatic,
      },
    };
  }
}
