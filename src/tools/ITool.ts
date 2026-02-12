import type { ZodSchema } from "zod";
import type { BrowserManager } from "../browser/BrowserManager.js";
import type { PageManager } from "../browser/PageManager.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { SQLiteStore } from "../memory/SQLiteStore.js";

/**
 * Tool execution context
 * Provides access to browser and page managers
 */
export interface ToolContext {
  browserManager: BrowserManager;
  pageManager: PageManager;
  sessionId: string;
  sessionManager: SessionManager;
  memoryStore: SQLiteStore;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  logs?: string[];
}

/**
 * ITool interface - Contract for all browser tools
 * Follows Interface Segregation Principle
 */
export interface ITool {
  /** Unique tool name (e.g., "browser_click") */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Zod schema for parameter validation */
  readonly parameters: ZodSchema;

  /** Whether the tool is read-only (doesn't mutate browser state) */
  readonly readOnly: boolean;

  /**
   * Execute the tool with validated parameters
   * @param params - Validated parameters matching the schema
   * @param context - Tool execution context
   * @returns Tool execution result
   */
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
}
