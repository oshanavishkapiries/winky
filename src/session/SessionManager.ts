import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

/**
 * SessionManager - Manages session lifecycle and file organization
 */
export class SessionManager {
  private readonly sessionsDir: string;

  constructor(dataDir: string = "data") {
    this.sessionsDir = resolve(process.cwd(), dataDir, "sessions");
  }

  /**
   * Create session folder structure
   */
  createSessionFolder(sessionId: string): void {
    const sessionPath = this.getSessionPath(sessionId);

    // Create main session folder
    if (!existsSync(sessionPath)) {
      mkdirSync(sessionPath, { recursive: true });
    }

    // Create subfolders
    const subfolders = ["screenshots", "pdfs", "uploads"];
    for (const folder of subfolders) {
      const folderPath = resolve(sessionPath, folder);
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }
    }
  }

  /**
   * Get session base path
   */
  getSessionPath(sessionId: string): string {
    return resolve(this.sessionsDir, sessionId);
  }

  /**
   * Get path for specific file type
   */
  getFilePath(
    sessionId: string,
    fileType: "screenshots" | "pdfs" | "uploads",
  ): string {
    return resolve(this.getSessionPath(sessionId), fileType);
  }

  /**
   * Get full file path with filename
   */
  getFullFilePath(
    sessionId: string,
    fileType: "screenshots" | "pdfs" | "uploads",
    filename: string,
  ): string {
    return resolve(this.getFilePath(sessionId, fileType), filename);
  }
}
