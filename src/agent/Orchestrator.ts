import type { ILLMProvider, LLMMessage } from "../llm/ILLMProvider.js";
import type { ToolRegistry } from "../tools/ToolRegistry.js";
import type { ToolContext } from "../tools/ITool.js";
import type { AgentStep } from "./types.js";
import { getLogger } from "../logger/Logger.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { MemoryManager } from "../memory/MemoryManager.js";

/**
 * Orchestrator - Core agent loop
 * Implements Plan → Act → Observe pattern
 */
export class Orchestrator {
  private llmProvider: ILLMProvider;
  private toolRegistry: ToolRegistry;
  private toolContext: ToolContext;
  private logger = getLogger();
  private conversationHistory: LLMMessage[] = [];
  private steps: AgentStep[] = [];
  private memory: MemoryManager | null = null;
  private currentSessionId: string | null = null;
  private axTreeUnavailable = false;
  private forceSnapshotNextStep = false;

  constructor(
    llmProvider: ILLMProvider,
    toolRegistry: ToolRegistry,
    toolContext: ToolContext,
    memory?: MemoryManager,
  ) {
    this.llmProvider = llmProvider;
    this.toolRegistry = toolRegistry;
    this.toolContext = toolContext;
    this.memory = memory || null;

    // Initialize with system prompt
    this.conversationHistory.push({
      role: "system",
      content: this.getSystemPrompt(),
    });
  }

  /**
   * Get system prompt for the agent
   */
  private getSystemPrompt(): string {
    const tools = this.toolRegistry.listTools();
    const toolList = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    return `You are Winky, an advanced browser automation agent powered by AI.

**Your Role:**
You assist users with web browsing tasks by controlling a real web browser. You can navigate websites, extract information, fill forms, and perform multi-step web workflows autonomously. You act naturally to avoid bot detection.

**Your Capabilities:**
You have access to ${tools.length} browser automation tools:

${toolList}

**Best Practices:**
1. Use browser_ax_tree FIRST to understand page structure (preferred for LLM)
2. Use browser_snapshot as fallback if ax-tree fails or for quick element lookup
3. NEVER assume element selectors - always verify with ax-tree or snapshot first
4. For interactive elements (search boxes, forms): Click the button/container FIRST, then take new snapshot to find the actual input field
5. Use exact element names from snapshots when interacting (use the 'name' field as 'ref')
6. Wait for pages to load before interacting (use browser_wait_for if needed)
7. Verify elements exist before interacting
8. Handle errors gracefully and retry with alternative approaches
9. Provide clear status updates to the user

**Behavior Guidelines:**
- Act like a human user (natural delays are automatic)
- Be patient with page loads
- Check ax-tree/snapshot to find correct element names
- If an element isn't found, take a new snapshot and try again
- Explain your reasoning before taking actions

**Tool Selection:**
- browser_ax_tree: DEFAULT - Full accessibility tree with hierarchy, roles, states, and relationships (best for LLM understanding)
- browser_snapshot: FALLBACK - Fast flat list of clickable elements if ax-tree fails or times out

**Data Extraction & Analysis (Token-Efficient):**
- browser_extract_data: For repetitive data extraction (e.g., scraping 1000s of items from search results, product listings, directories)
  * LLM defines the pattern (CSS selectors, columns, pagination)
  * Tool autonomously iterates through all items (zero LLM tokens per item)
  * Saves JSON dataset in session folder
- data_analyze: For processing large datasets internally
  * Filter, sort, group, aggregate operations run internally
  * LLM receives only summary and sample rows (not raw data)
  * Export results as CSV or JSON
  * Example: "Filter rating > 4.0, sort by reviews DESC, export top 50 as CSV"

**Important Notes:**
- Element names in snapshots are the accessible names (what screen readers see)
- Links may have different text than their href
- Buttons may have aria-labels different from visible text
- Always verify the snapshot before clicking

Begin each task by understanding the goal, then plan your approach step by step.`;
  }

  /**
   * Execute a single user request
   */
  async executeTask(userRequest: string, maxSteps: number = 10): Promise<void> {
    this.logger.workflow("info", "Starting task execution", {
      userRequest,
      maxSteps,
    });

    // Start new session if memory enabled
    if (this.memory) {
      this.currentSessionId = this.memory.startSession(userRequest);
      this.memory.saveMessage(
        this.currentSessionId,
        "system",
        this.getSystemPrompt(),
      );
    }

    // Add user message to history
    this.conversationHistory.push({
      role: "user",
      content: userRequest,
    });

    // Save user message to memory
    if (this.memory && this.currentSessionId) {
      this.memory.saveMessage(this.currentSessionId, "user", userRequest);
    }

    // Probe ax-tree once per runtime and remove it from planning if unavailable.
    if (!this.axTreeUnavailable && this.toolRegistry.hasTool("browser_ax_tree")) {
      try {
        const axTool = this.toolRegistry.getTool("browser_ax_tree");
        const axProbe = await axTool.execute({}, this.toolContext);

        if (!axProbe.success) {
          const errorText = String(axProbe.error || "");
          if (errorText.includes("Accessibility API not available")) {
            this.axTreeUnavailable = true;
            this.conversationHistory.push({
              role: "assistant",
              content:
                "Tool browser_ax_tree is unavailable in this browser runtime. Do not call browser_ax_tree again in this session; use browser_snapshot for page understanding.",
            });
          }
        } else {
          // ax-tree is available - prefer it by default.
          this.forceSnapshotNextStep = false;
        }
      } catch {
        // Ignore probe errors and continue normal planning.
      }
    }

    for (let step = 0; step < maxSteps; step++) {
      this.logger.workflow("info", `Step ${step + 1}/${maxSteps}`);

      // Plan: Get LLM decision
      const tools = this.toolRegistry
        .listTools()
        .filter((tool) => {
          // If ax-tree is unavailable, never expose it.
          if (this.axTreeUnavailable && tool.name === "browser_ax_tree") {
            return false;
          }

          // Strict policy: when ax-tree is available, prefer it and hide snapshot
          // except when we explicitly need one fallback step.
          if (!this.axTreeUnavailable && !this.forceSnapshotNextStep) {
            if (tool.name === "browser_snapshot") {
              return false;
            }
          }

          // If fallback step is requested, force snapshot by hiding ax-tree once.
          if (!this.axTreeUnavailable && this.forceSnapshotNextStep) {
            if (tool.name === "browser_ax_tree") {
              return false;
            }
          }

          return true;
        })
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.parameters) as Record<string, unknown>,
        }));

      const response = await this.llmProvider.chat(this.conversationHistory, {
        tools,
        temperature: 0.2,
      });

      // Check if LLM wants to use tools
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // No more tools to call - task complete
        this.logger.workflow("info", "Task completed", {
          response: response.content,
          totalSteps: step + 1,
        });

        this.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });

        // Save completion to memory
        if (this.memory && this.currentSessionId) {
          this.memory.saveMessage(
            this.currentSessionId,
            "assistant",
            response.content,
          );
          this.memory.completeSession(this.currentSessionId, true);
        }

        console.log("\n✅ Task completed!");
        console.log(`Agent: ${response.content}\n`);
        break;
      }

      // Act: Execute tool calls
      for (const toolCall of response.toolCalls) {
        this.logger.workflow("info", "Executing tool", {
          tool: toolCall.name,
          params: toolCall.arguments,
        });

        try {
          const tool = this.toolRegistry.getTool(toolCall.name);
          const result = await tool.execute(
            toolCall.arguments,
            this.toolContext,
          );

          // Observe: Record the result
          const agentStep: AgentStep = {
            action: {
              toolName: toolCall.name,
              parameters: toolCall.arguments,
            },
            observation: {
              success: result.success,
              data: result.data,
              error: result.error,
            },
            timestamp: new Date(),
          };

          this.steps.push(agentStep);

          // Save tool execution to memory
          if (this.memory && this.currentSessionId) {
            this.memory.saveToolExecution(
              this.currentSessionId,
              toolCall.name,
              toolCall.arguments,
              result.data,
              result.success,
            );
          }

          // Add observation to conversation
          const observationMessage = result.success
            ? `Tool ${toolCall.name} succeeded. Result: ${JSON.stringify(result.data)}`
            : `Tool ${toolCall.name} failed. Error: ${result.error}`;

          // Enforce strict ax-tree/snapshot switching policy.
          if (toolCall.name === "browser_ax_tree") {
            if (!result.success) {
              const errorText = String(result.error || "");

              if (errorText.includes("Accessibility API not available")) {
                this.axTreeUnavailable = true;
                this.forceSnapshotNextStep = false;
                this.conversationHistory.push({
                  role: "assistant",
                  content:
                    "browser_ax_tree is unavailable in this runtime. Switch to browser_snapshot for all future page understanding steps.",
                });
              } else {
                // Transient failure: request one snapshot fallback step, then return to ax-tree.
                this.forceSnapshotNextStep = true;
                this.conversationHistory.push({
                  role: "assistant",
                  content:
                    "browser_ax_tree failed for this step. Use browser_snapshot on the next step as fallback, then continue with browser_ax_tree.",
                });
              }
            } else {
              this.forceSnapshotNextStep = false;
            }
          }

          if (toolCall.name === "browser_snapshot" && this.forceSnapshotNextStep) {
            // One-time fallback consumed, switch back to ax-tree.
            this.forceSnapshotNextStep = false;
          }

          this.conversationHistory.push({
            role: "assistant",
            content: observationMessage,
          });

          console.log(`\n🔧 ${toolCall.name}`);
          console.log(
            `   ${result.success ? "✅" : "❌"} ${observationMessage}\n`,
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          this.logger.workflow("error", "Tool execution failed", {
            tool: toolCall.name,
            error: errorMsg,
          });

          this.conversationHistory.push({
            role: "assistant",
            content: `Tool ${toolCall.name} failed with error: ${errorMsg}`,
          });
        }
      }
    }

    this.logger.workflow("info", "Task execution finished", {
      totalSteps: this.steps.length,
    });
  }

  /**
   * Get execution history
   */
  getSteps(): AgentStep[] {
    return this.steps;
  }

  /**
   * Clear execution history
   */
  reset(): void {
    this.steps = [];
    this.conversationHistory = [
      {
        role: "system",
        content: this.getSystemPrompt(),
      },
    ];
  }
}
