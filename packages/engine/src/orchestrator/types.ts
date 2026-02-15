import type { RunInput, LandingExtract, AgentOutput, SimEvent, Report, PersonaId } from '@simvibe/shared';

export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OrchestratorConfig {
  llm: LLMConfig;
  maxRetries?: number;
  timeoutMs?: number;
  enableDebate?: boolean;
  debateRounds?: number;
  personaIds?: string[];
  timeBudgetMs?: number;
  maxAgentConcurrency?: number;
  perAgentTimeoutMs?: number;
}

export interface SimulationContext {
  runId: string;
  input: RunInput;
  landingExtract: LandingExtract;
  config: OrchestratorConfig;
}

export interface AgentResult {
  personaId: PersonaId;
  output: AgentOutput;
  rawResponse?: string;
  retryCount: number;
  durationMs: number;
}

export type SimulationEventHandler = (event: SimEvent) => void | Promise<void>;

export interface SimulationResult {
  runId: string;
  agentResults: AgentResult[];
  events: SimEvent[];
  report?: Report;
  error?: string;
  earlyStopReason?: string;
  durationMs: number;
}
