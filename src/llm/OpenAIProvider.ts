import OpenAI from "openai";
import type { ILLMProvider, LLMMessage, LLMResponse } from "./ILLMProvider.js";
import { getLogger } from "../logger/Logger.js";
import { LLMError } from "../utils/errors.js";

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;
  private logger = getLogger();

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      }>;
    },
  ): Promise<LLMResponse> {
    try {
      this.logger.llm("info", "Sending chat request", {
        model: this.model,
        messageCount: messages.length,
        toolCount: options?.tools?.length || 0,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        tools: options?.tools?.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMError("No response from LLM");
      }

      // Extract tool calls if present
      const toolCalls = choice.message.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      const result: LLMResponse = {
        content: choice.message.content || "",
        toolCalls,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };

      this.logger.llm("info", "Received chat response", {
        hasToolCalls: !!toolCalls,
        toolCallCount: toolCalls?.length || 0,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.llm("error", "Chat request failed", { error: message });
      throw new LLMError(`OpenAI chat failed: ${message}`);
    }
  }
}
