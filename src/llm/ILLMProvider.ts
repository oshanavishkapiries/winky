/**
 * LLM Provider Interface
 * Follows Interface Segregation Principle
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMProvider {
  /**
   * Send a chat completion request
   */
  chat(
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
  ): Promise<LLMResponse>;
}
