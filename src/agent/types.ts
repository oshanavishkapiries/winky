/**
 * Agent types for orchestration
 */

export interface AgentAction {
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface AgentObservation {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentStep {
  action: AgentAction;
  observation: AgentObservation;
  timestamp: Date;
}
