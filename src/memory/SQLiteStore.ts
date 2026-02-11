import Database from "better-sqlite3";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import type { Session, Message, ToolExecution } from "./types.js";
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

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_tools_session ON tool_executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
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
   * Close the database
   */
  close(): void {
    this.db.close();
    this.logger.workflow("info", "SQLite database closed");
  }
}
