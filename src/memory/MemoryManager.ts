import { SQLiteStore } from "./SQLiteStore.js";
import type {
  Session,
  Message,
  ToolExecution,
  SessionContext,
} from "./types.js";
import { getLogger } from "../logger/Logger.js";

/**
 * MemoryManager - High-level memory management interface
 */
export class MemoryManager {
  private store: SQLiteStore;
  private logger = getLogger();
  private currentSessionId: string | null = null;

  constructor(dbPath: string) {
    this.store = new SQLiteStore(dbPath);
    this.logger.workflow("info", "Memory manager initialized");
  }

  /**
   * Start a new session
   */
  startSession(goal: string): string {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      goal,
      status: "active",
      totalSteps: 0,
    };

    this.store.saveSession(session);
    this.currentSessionId = sessionId;

    this.logger.workflow("info", "Started new session", {
      sessionId,
      goal,
    });

    return sessionId;
  }

  /**
   * Update session
   */
  updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, "id" | "createdAt">>,
  ): void {
    const session = this.store.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: Session = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };

    this.store.saveSession(updated);
  }

  /**
   * Complete current session
   */
  completeSession(sessionId: string, success: boolean = true): void {
    this.updateSession(sessionId, {
      status: success ? "completed" : "failed",
    });

    this.logger.workflow("info", "Session completed", {
      sessionId,
      success,
    });
  }

  /**
   * Save a message
   */
  saveMessage(
    sessionId: string,
    role: "system" | "user" | "assistant",
    content: string,
  ): void {
    const message: Message = {
      sessionId,
      role,
      content,
      timestamp: Date.now(),
    };

    this.store.saveMessage(message);
  }

  /**
   * Save tool execution
   */
  saveToolExecution(
    sessionId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    result: unknown,
    success: boolean,
  ): void {
    const execution: ToolExecution = {
      sessionId,
      toolName,
      parameters,
      result,
      success,
      timestamp: Date.now(),
    };

    this.store.saveToolExecution(execution);

    // Update session step count
    const session = this.store.getSession(sessionId);
    if (session) {
      this.updateSession(sessionId, {
        totalSteps: session.totalSteps + 1,
      });
    }
  }

  /**
   * Get full session context
   */
  getSessionContext(sessionId: string): SessionContext | null {
    const session = this.store.getSession(sessionId);
    if (!session) return null;

    const messages = this.store.getMessages(sessionId);
    const toolExecutions = this.store.getToolExecutions(sessionId);

    return {
      session,
      messages,
      toolExecutions,
    };
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit: number = 10): Session[] {
    return this.store.getRecentSessions(limit);
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Close memory manager
   */
  close(): void {
    this.store.close();
  }
}
