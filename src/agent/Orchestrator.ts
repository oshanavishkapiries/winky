import type { ILLMProvider, LLMMessage } from "../llm/ILLMProvider.js";
import type { ToolRegistry } from "../tools/ToolRegistry.js";
import type { ToolContext } from "../tools/ITool.js";
import type { AgentStep } from "./types.js";
import { getLogger } from "../logger/Logger.js";
import { zodToJsonSchema } from "zod-to-json-schema";

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

  constructor(
    llmProvider: ILLMProvider,
    toolRegistry: ToolRegistry,
    toolContext: ToolContext,
  ) {
    this.llmProvider = llmProvider;
    this.toolRegistry = toolRegistry;
    this.toolContext = toolContext;

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

    return `You are Winky, a browser automation agent. You can control a web browser using the following tools:

${toolList}

Be precise and methodical. Explain your reasoning before taking actions.`;
  }

  /**
   * Execute a single user request
   */
  async executeTask(userRequest: string, maxSteps: number = 10): Promise<void> {
    this.logger.workflow("info", "Starting task execution", {
      userRequest,
      maxSteps,
    });

    // Add user message to history
    this.conversationHistory.push({
      role: "user",
      content: userRequest,
    });

    for (let step = 0; step < maxSteps; step++) {
      this.logger.workflow("info", `Step ${step + 1}/${maxSteps}`);

      // Plan: Get LLM decision
      const tools = this.toolRegistry.listTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters) as Record<string, unknown>,
      }));

      const response = await this.llmProvider.chat(this.conversationHistory, {
        tools,
        temperature: 0.7,
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

          // Add observation to conversation
          const observationMessage = result.success
            ? `Tool ${toolCall.name} succeeded. Result: ${JSON.stringify(result.data)}`
            : `Tool ${toolCall.name} failed. Error: ${result.error}`;

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
