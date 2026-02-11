/**
 * Custom error classes for Winky
 * Provides better error categorization and handling
 */

export class WinkyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WinkyError";
  }
}

export class ConfigError extends WinkyError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class BrowserError extends WinkyError {
  constructor(message: string) {
    super(message);
    this.name = "BrowserError";
  }
}

export class LLMError extends WinkyError {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export class AgentError extends WinkyError {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export class ToolError extends WinkyError {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
