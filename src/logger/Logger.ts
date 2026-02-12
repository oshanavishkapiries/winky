import winston from "winston";
import type { SQLiteStore } from "../memory/SQLiteStore.js";

export type LogCategory = "workflow" | "llm" | "browser" | "tool";
export type LogLevel = "info" | "warn" | "error";

/**
 * Logger with SQLite storage and console output
 * Follows Single Responsibility Principle
 */
export class Logger {
  private consoleLogger: winston.Logger;
  private store: SQLiteStore | null = null;
  private currentSessionId: string | null = null;

  constructor(logLevel: string = "info") {
    // Console-only logger for development
    this.consoleLogger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, category }) => {
          const cat = category ? `[${category}]` : "";
          return `${timestamp} ${level} ${cat}: ${message}`;
        }),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  /**
   * Set SQLite store for database logging
   */
  setStore(store: SQLiteStore): void {
    this.store = store;
  }

  /**
   * Set current session ID for logging
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Log to console and SQLite
   */
  log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    // Always log to console
    this.consoleLogger.log(level, message, { category, ...meta });

    // Log to SQLite if available
    if (this.store && this.currentSessionId) {
      this.store.saveWorkflowLog({
        sessionId: this.currentSessionId,
        timestamp: Date.now(),
        level,
        category,
        message,
        metadata: meta,
      });
    }
  }

  /**
   * Convenience methods for each category
   */
  workflow(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.log("workflow", level, message, meta);
  }

  llm(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    this.log("llm", level, message, meta);
  }

  browser(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.log("browser", level, message, meta);
  }

  tool(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    this.log("tool", level, message, meta);
  }

  /**
   * Shutdown logger gracefully
   */
  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.consoleLogger.close();
      this.consoleLogger.on("finish", resolve);
    });
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(logLevel?: string): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(logLevel);
  }
  return loggerInstance;
}
