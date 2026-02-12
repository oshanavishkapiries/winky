/**
 * Memory system type definitions
 */

/**
 * Session record
 */
export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  goal: string;
  status: "active" | "completed" | "failed";
  totalSteps: number;
}

/**
 * Message record
 */
export interface Message {
  id?: number;
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Tool execution record
 */
export interface ToolExecution {
  id?: number;
  sessionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  success: boolean;
  timestamp: number;
}

/**
 * Session with full context
 */
export interface SessionContext {
  session: Session;
  messages: Message[];
  toolExecutions: ToolExecution[];
}

/**
 * Console log record
 */
export interface ConsoleLog {
  id?: number;
  sessionId: string;
  timestamp: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
  url?: string;
}

/**
 * Network request log record
 */
export interface NetworkLog {
  id?: number;
  sessionId: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  resourceType?: string;
}

/**
 * LLM API call log record
 */
export interface LLMLog {
  id?: number;
  sessionId: string;
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration?: number;
}

/**
 * Workflow/system log record
 */
export interface WorkflowLog {
  id?: number;
  sessionId: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  category: "workflow" | "browser" | "llm" | "tool";
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Session file record
 */
export interface SessionFile {
  id?: number;
  sessionId: string;
  fileType: "screenshot" | "pdf" | "upload";
  filePath: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}
