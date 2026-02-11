import type { ZodSchema } from "zod";
import { getLogger } from "../logger/Logger.js";
import { ToolError } from "../utils/errors.js";
import type { ITool, ToolContext, ToolResult } from "./ITool.js";

/**
 * BaseTool - Abstract base class for all tools
 * Provides common functionality: parameter validation, logging, error handling
 * Follows Template Method Pattern
 */
export abstract class BaseTool implements ITool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ZodSchema;
  abstract readonly readOnly: boolean;

  protected logger = getLogger();

  /**
   * Execute the tool with automatic validation and error handling
   */
  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Log tool execution start
      this.logger.browser("info", `Executing tool: ${this.name}`, {
        params: validatedParams,
        readOnly: this.readOnly,
      });

      // Execute the tool-specific logic
      const result = await this.executeImpl(validatedParams, context);

      // Log success
      const duration = Date.now() - startTime;
      this.logger.browser("info", `Tool ${this.name} completed`, {
        success: result.success,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.browser("error", `Tool ${this.name} failed`, {
        error: errorMessage,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate parameters against the schema
   */
  protected validateParams(params: unknown): unknown {
    try {
      return this.parameters.parse(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ToolError(
        `Parameter validation failed for ${this.name}: ${message}`,
      );
    }
  }

  /**
   * Tool-specific implementation
   * Must be implemented by subclasses
   */
  protected abstract executeImpl(
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult>;
}
