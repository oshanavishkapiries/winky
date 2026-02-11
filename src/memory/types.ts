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
