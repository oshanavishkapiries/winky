import { resolve } from "node:path";
import { writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import type { SessionManager } from "../session/SessionManager.js";
import type { SQLiteStore } from "../memory/SQLiteStore.js";

/**
 * DataStore - Utility for managing dataset files in session folders
 * Supports JSON and CSV formats
 */
export class DataStore {
  private sessionManager: SessionManager;
  private store: SQLiteStore;

  constructor(sessionManager: SessionManager, store: SQLiteStore) {
    this.sessionManager = sessionManager;
    this.store = store;
  }

  /**
   * Save dataset as JSON
   */
  saveDataset(
    sessionId: string,
    name: string,
    data: Record<string, unknown>[],
  ): string {
    const filename = `${name}.json`;
    const filePath = resolve(
      this.sessionManager.getSessionPath(sessionId),
      "datasets",
      filename,
    );

    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    // Record in session_files table
    this.store.saveSessionFile({
      sessionId,
      fileType: "upload", // using upload as generic data file type
      filePath: `datasets/${filename}`,
      createdAt: Date.now(),
      metadata: {
        format: "json",
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0,
      },
    });

    return filePath;
  }

  /**
   * Load dataset from JSON
   */
  loadDataset(sessionId: string, name: string): Record<string, unknown>[] {
    const filename = `${name}.json`;
    const filePath = resolve(
      this.sessionManager.getSessionPath(sessionId),
      "datasets",
      filename,
    );

    if (!existsSync(filePath)) {
      throw new Error(`Dataset not found: ${name}`);
    }

    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>[];
  }

  /**
   * Export dataset as CSV
   */
  exportCSV(
    sessionId: string,
    name: string,
    data: Record<string, unknown>[],
  ): string {
    if (data.length === 0) {
      throw new Error("Cannot export empty dataset to CSV");
    }

    const filename = `${name}.csv`;
    const filePath = resolve(
      this.sessionManager.getSessionPath(sessionId),
      "datasets",
      filename,
    );

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Create CSV header
    const header = columns.map((col) => this.escapeCSV(col)).join(",");

    // Create CSV rows
    const rows = data.map((row) => {
      return columns
        .map((col) => {
          const value = row[col];
          return this.escapeCSV(String(value ?? ""));
        })
        .join(",");
    });

    // Write CSV file
    const csv = [header, ...rows].join("\n");
    writeFileSync(filePath, csv, "utf-8");

    // Record in session_files table
    this.store.saveSessionFile({
      sessionId,
      fileType: "upload",
      filePath: `datasets/${filename}`,
      createdAt: Date.now(),
      metadata: {
        format: "csv",
        rows: data.length,
        columns: columns.length,
      },
    });

    return filePath;
  }

  /**
   * Get dataset info without loading full data
   */
  getDatasetInfo(
    sessionId: string,
    name: string,
  ): { rows: number; columns: string[]; sizeBytes: number } {
    const filename = `${name}.json`;
    const filePath = resolve(
      this.sessionManager.getSessionPath(sessionId),
      "datasets",
      filename,
    );

    if (!existsSync(filePath)) {
      throw new Error(`Dataset not found: ${name}`);
    }

    const stats = statSync(filePath);
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>[];

    return {
      rows: data.length,
      columns: data.length > 0 ? Object.keys(data[0]) : [],
      sizeBytes: stats.size,
    };
  }

  /**
   * Escape CSV value (handle quotes and commas)
   */
  private escapeCSV(value: string): string {
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
