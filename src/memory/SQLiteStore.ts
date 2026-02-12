import Database from "better-sqlite3";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import type {
  Session,
  Message,
  ToolExecution,
  ConsoleLog,
  NetworkLog,
  LLMLog,
  WorkflowLog,
  SessionFile,
} from "./types.js";
import { getLogger } from "../logger/Logger.js";

/**
 * SQLiteStore - Handles all SQLite database operations
 */
export class SQLiteStore {
  private db: Database.Database;
  private logger = getLogger();

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = resolve(dbPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.logger.workflow("info", "SQLite database initialized", { dbPath });

    // Create tables
    this.initializeTables();
  }

  /**
   * Create database tables
   */
  private initializeTables(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        goal TEXT,
        status TEXT DEFAULT 'active',
        total_steps INTEGER DEFAULT 0
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Tool executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        parameters TEXT NOT NULL,
        result TEXT,
        success INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Browser console logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS console_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        url TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Network request logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        status INTEGER,
        resource_type TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // LLM API call logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Workflow/system logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Session files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_tools_session ON tool_executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_console_session ON console_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_network_session ON network_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_llm_session ON llm_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_session ON workflow_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_files_session ON session_files(session_id);
    `);

    this.logger.workflow("info", "Database tables initialized");
  }

  /**
   * Save a session
   */
  saveSession(session: Session): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, created_at, updated_at, goal, status, total_steps)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.createdAt,
      session.updatedAt,
      session.goal,
      session.status,
      session.totalSteps,
    );
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const row = stmt.get(sessionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      goal: row.goal,
      status: row.status,
      totalSteps: row.total_steps,
    };
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit: number = 10): Session[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      ORDER BY updated_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      goal: row.goal,
      status: row.status,
      totalSteps: row.total_steps,
    }));
  }

  /**
   * Save a message
   */
  saveMessage(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      message.sessionId,
      message.role,
      message.content,
      message.timestamp,
    );
  }

  /**
   * Get messages for a session
   */
  getMessages(sessionId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Save a tool execution
   */
  saveToolExecution(execution: ToolExecution): void {
    const stmt = this.db.prepare(`
      INSERT INTO tool_executions (session_id, tool_name, parameters, result, success, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      execution.sessionId,
      execution.toolName,
      JSON.stringify(execution.parameters),
      JSON.stringify(execution.result),
      execution.success ? 1 : 0,
      execution.timestamp,
    );
  }

  /**
   * Get tool executions for a session
   */
  getToolExecutions(sessionId: string): ToolExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tool_executions 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      toolName: row.tool_name,
      parameters: JSON.parse(row.parameters),
      result: JSON.parse(row.result),
      success: row.success === 1,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Save a console log
   */
  saveConsoleLog(log: ConsoleLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO console_logs (session_id, timestamp, level, message, url)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(log.sessionId, log.timestamp, log.level, log.message, log.url);
  }

  /**
   * Save a network request log
   */
  saveNetworkLog(log: NetworkLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO network_logs (session_id, timestamp, method, url, status, resource_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.sessionId,
      log.timestamp,
      log.method,
      log.url,
      log.status,
      log.resourceType,
    );
  }

  /**
   * Save an LLM API call log
   */
  saveLLMLog(log: LLMLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO llm_logs (session_id, timestamp, model, prompt_tokens, completion_tokens, total_tokens, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.sessionId,
      log.timestamp,
      log.model,
      log.promptTokens,
      log.completionTokens,
      log.totalTokens,
      log.duration,
    );
  }

  /**
   * Save a workflow/system log
   */
  saveWorkflowLog(log: WorkflowLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_logs (session_id, timestamp, level, category, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.sessionId,
      log.timestamp,
      log.level,
      log.category,
      log.message,
      log.metadata ? JSON.stringify(log.metadata) : null,
    );
  }

  /**
   * Save a session file record
   */
  saveSessionFile(file: SessionFile): void {
    const stmt = this.db.prepare(`
      INSERT INTO session_files (session_id, file_type, file_path, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      file.sessionId,
      file.fileType,
      file.filePath,
      file.createdAt,
      file.metadata ? JSON.stringify(file.metadata) : null,
    );
  }

  /**
   * Close the database
   */
  close(): void {
    this.db.close();
    this.logger.workflow("info", "SQLite database closed");
  }
}
