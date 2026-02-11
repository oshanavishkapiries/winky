import winston from "winston";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

export type LogCategory = "workflow" | "llm" | "browser";

/**
 * Winston-based logger with separate file transports for each category
 * Follows Single Responsibility Principle
 */
export class Logger {
  private loggers: Map<LogCategory, winston.Logger> = new Map();
  private logDir: string;

  constructor(logLevel: string = "info", logDir: string = "data/logs") {
    this.logDir = resolve(process.cwd(), logDir);
    this.ensureLogDirectories();
    this.initializeLoggers(logLevel);
  }

  /**
   * Ensure all log directories exist
   */
  private ensureLogDirectories(): void {
    const categories: LogCategory[] = ["workflow", "llm", "browser"];

    for (const category of categories) {
      const dir = resolve(this.logDir, category);
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Initialize Winston loggers for each category
   */
  private initializeLoggers(logLevel: string): void {
    const categories: LogCategory[] = ["workflow", "llm", "browser"];

    for (const category of categories) {
      const logger = winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        transports: [
          // File transport for this category
          new winston.transports.File({
            filename: resolve(this.logDir, category, `${category}.log`),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
          // Console transport for development
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
        ],
      });

      this.loggers.set(category, logger);
    }
  }

  /**
   * Log to a specific category
   */
  log(
    category: LogCategory,
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const logger = this.loggers.get(category);
    if (!logger) {
      throw new Error(`Unknown log category: ${category}`);
    }

    logger.log(level, message, meta);
  }

  /**
   * Convenience methods for each category
   */
  workflow(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.log("workflow", level, message, meta);
  }

  llm(level: string, message: string, meta?: Record<string, unknown>): void {
    this.log("llm", level, message, meta);
  }

  browser(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.log("browser", level, message, meta);
  }

  /**
   * Shutdown all loggers gracefully
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.loggers.values()).map(
      (logger) =>
        new Promise<void>((resolve) => {
          logger.close();
          logger.on("finish", resolve);
        }),
    );

    await Promise.all(closePromises);
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
