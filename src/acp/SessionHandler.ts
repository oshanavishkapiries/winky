import type { Orchestrator } from "../agent/Orchestrator.js";
import type * as acp from "@agentclientprotocol/sdk";
import { getLogger } from "../logger/Logger.js";

/**
 * Session data for tracking ACP sessions
 */
interface SessionData {
  id: string;
  orchestrator: Orchestrator;
  createdAt: number;
  mode: string;
}

/**
 * SessionHandler - Manages ACP sessions and wires them to the Orchestrator
 * Handles prompt execution and streams updates back to the client
 */
export class SessionHandler {
  private sessions: Map<string, SessionData> = new Map();
  private logger = getLogger();
  private connection: acp.AgentSideConnection;

  constructor(
    private orchestrator: Orchestrator,
    connection: acp.AgentSideConnection,
  ) {
    this.connection = connection;
  }

  /**
   * Create a new session
   */
  createSession(sessionId: string): SessionData {
    const session: SessionData = {
      id: sessionId,
      orchestrator: this.orchestrator,
      createdAt: Date.now(),
      mode: "code",
    };

    this.sessions.set(sessionId, session);
    this.logger.workflow("info", "Created ACP session", { sessionId });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Handle a prompt request from the client
   */
  async handlePrompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.getSession(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    this.logger.workflow("info", "Handling ACP prompt", {
      sessionId: params.sessionId,
      promptLength: params.prompt.length,
    });

    // Extract text from prompt
    const promptText = params.prompt
      .filter((p) => p.type === "text")
      .map((p) => (p as acp.TextContent).text)
      .join("\n");

    if (!promptText) {
      return { stopReason: "end_turn" };
    }

    // Send initial update
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "🤖 Winky is processing your request...\n",
        },
      },
    });

    try {
      // Execute task via Orchestrator
      // Note: We'll need to modify Orchestrator to support streaming updates
      await session.orchestrator.executeTask(promptText);

      // Send completion update
      await this.connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: "\n✅ Task completed successfully!",
          },
        },
      });

      return { stopReason: "end_turn" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await this.connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: `\n❌ Error: ${errorMsg}`,
          },
        },
      });

      return { stopReason: "end_turn" };
    }
  }

  /**
   * Set session mode
   */
  setSessionMode(sessionId: string, mode: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.mode = mode;
      this.logger.workflow("info", "Session mode changed", { sessionId, mode });
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.workflow("info", "Deleted ACP session", { sessionId });
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }
}
