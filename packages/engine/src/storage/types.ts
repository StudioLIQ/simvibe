import type {
  RunInput,
  LandingExtract,
  AgentOutput,
  SimEvent,
  Report,
  ActualOutcomes,
  CalibrationPrior,
} from '@simvibe/shared';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  input: RunInput;
  landingExtract?: LandingExtract;
  agentOutputs: AgentOutput[];
  events: SimEvent[];
  report?: Report;
  actuals?: ActualOutcomes;
  variantOf?: string;
  error?: string;
}

export interface Storage {
  createRun(input: RunInput): Promise<Run>;
  getRun(runId: string): Promise<Run | null>;
  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void>;
  saveLandingExtract(runId: string, extract: LandingExtract): Promise<void>;
  appendEvent(runId: string, event: SimEvent): Promise<void>;
  saveAgentOutput(runId: string, output: AgentOutput): Promise<void>;
  saveReport(runId: string, report: Report): Promise<void>;
  saveActuals(runId: string, actuals: ActualOutcomes): Promise<void>;
  getCalibrationPrior(key: string): Promise<CalibrationPrior | null>;
  saveCalibrationPrior(prior: CalibrationPrior): Promise<void>;
  listRuns(limit?: number): Promise<Run[]>;
  close(): Promise<void>;
}
