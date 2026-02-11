import type { ILLMProvider } from "./ILLMProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { OpenRouterProvider } from "./OpenRouterProvider.js";
import type { WinkyConfig } from "../config/schema.js";
import { getLogger } from "../logger/Logger.js";
import { LLMError } from "../utils/errors.js";

/**
 * LLM Service - Factory for LLM providers
 * Follows Dependency Inversion Principle
 */
export class LLMService {
  private provider: ILLMProvider;
  private logger = getLogger();

  constructor(config: WinkyConfig["llm"]) {
    this.logger.llm("info", "Initializing LLM service", {
      provider: config.provider,
      model: config.model,
    });

    // Factory pattern - create provider based on config
    switch (config.provider) {
      case "openai":
        this.provider = new OpenAIProvider(
          config.apiKey,
          config.model,
          config.baseURL,
        );
        break;

      case "openrouter":
        this.provider = new OpenRouterProvider(config.apiKey, config.model);
        break;

      default:
        throw new LLMError(`Unknown LLM provider: ${config.provider}`);
    }
  }

  /**
   * Get the underlying provider
   */
  getProvider(): ILLMProvider {
    return this.provider;
  }
}
