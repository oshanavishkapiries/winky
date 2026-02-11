import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import type { Orchestrator } from "../agent/Orchestrator.js";
import { SessionHandler } from "./SessionHandler.js";
import { getLogger } from "../logger/Logger.js";

/**
 * ACPServer - Agent Client Protocol server implementation
 * Allows Winky to be used as a server that code editors can connect to
 */
export class ACPServer implements acp.Agent {
  private connection: acp.AgentSideConnection;
  private sessionHandler: SessionHandler;
  private logger = getLogger();

  constructor(private orchestrator: Orchestrator) {
    // Create the connection first (will be initialized in start())
    this.connection = null as any; // Temporary, will be set in start()
    this.sessionHandler = null as any; // Temporary, will be set in start()
  }

  /**
   * Start the ACP server
   */
  async start(): Promise<void> {
    this.logger.workflow("info", "Starting ACP server...");

    // Set up stdio-based communication
    const input = Writable.toWeb(process.stdout);
    const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);

    // Create the connection
    this.connection = new acp.AgentSideConnection((conn) => {
      // Initialize session handler with connection
      this.sessionHandler = new SessionHandler(this.orchestrator, conn);
      return this;
    }, stream);

    // Monitor connection lifecycle
    this.connection.signal.addEventListener("abort", () => {
      this.logger.workflow("info", "ACP connection closed");
    });

    this.logger.workflow("info", "ACP server started on stdio");

    // Wait for connection to close
    await this.connection.closed;
  }

  /**
   * Initialize the agent
   */
  async initialize(
    params: acp.InitializeRequest,
  ): Promise<acp.InitializeResponse> {
    this.logger.workflow("info", "ACP initialize request", {
      protocolVersion: params.protocolVersion,
    });

    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false, // We don't support session persistence yet
      },
    };
  }

  /**
   * Create a new session
   */
  async newSession(
    params: acp.NewSessionRequest,
  ): Promise<acp.NewSessionResponse> {
    const sessionId = crypto.randomUUID();

    this.logger.workflow("info", "Creating new ACP session", {
      sessionId,
      cwd: params.cwd,
    });

    // Create session in handler
    this.sessionHandler.createSession(sessionId);

    return { sessionId };
  }

  /**
   * Authenticate (optional - we don't require auth)
   */
  async authenticate(
    _params: acp.AuthenticateRequest,
  ): Promise<acp.AuthenticateResponse> {
    this.logger.workflow("info", "ACP authenticate request");
    return {}; // No authentication required
  }

  /**
   * Handle a prompt from the client
   */
  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    this.logger.workflow("info", "ACP prompt request", {
      sessionId: params.sessionId,
    });

    return await this.sessionHandler.handlePrompt(params);
  }

  /**
   * Handle cancellation
   */
  async cancel(params: acp.CancelNotification): Promise<void> {
    this.logger.workflow("info", "ACP cancel request", {
      sessionId: params.sessionId,
    });

    // TODO: Implement cancellation in Orchestrator
  }
}
