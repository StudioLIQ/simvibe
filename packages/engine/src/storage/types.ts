import type {
  RunInput,
  LandingExtract,
  AgentOutput,
  SimEvent,
  Report,
  ActualOutcomes,
  CalibrationPrior,
  RunDiagnostics,
  ChainReceipt,
  PersonaSnapshots,
  NadLaunchInput,
  LaunchReadiness,
  LaunchRecord,
  ReportStatus,
  ReportLifecycle,
  ReportRevision,
} from '@simvibe/shared';

export type RunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

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
  diagnostics?: RunDiagnostics;
  receipt?: ChainReceipt;
  // Denormalized receipt linkage fields (queryable columns)
  receiptTxHash?: string;
  receiptContract?: string;
  receiptChainId?: number;
  receiptPublishedAt?: string;
  personaSnapshots?: PersonaSnapshots;
  launchReadiness?: LaunchReadiness;
  launchInput?: NadLaunchInput;
  launchRecord?: LaunchRecord;
  // Denormalized launch linkage fields (queryable columns)
  launchTxHash?: string;
  tokenContractAddress?: string;
  nadLaunchUrl?: string;
  launchConfirmedAt?: string;
  // Report lifecycle fields
  reportStatus?: ReportStatus;
  reportVersion?: number;
  reportLifecycle?: ReportLifecycle;
  reportRevisions?: ReportRevision[];
  variantOf?: string;
  error?: string;
}

export interface Storage {
  createRun(input: RunInput): Promise<Run>;
  getRun(runId: string): Promise<Run | null>;
  getRunStatus(runId: string): Promise<RunStatus | null>;
  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void>;
  saveLandingExtract(runId: string, extract: LandingExtract): Promise<void>;
  appendEvent(runId: string, event: SimEvent): Promise<void>;
  getEventsSince(runId: string, sinceId?: string): Promise<SimEvent[]>;
  saveAgentOutput(runId: string, output: AgentOutput): Promise<void>;
  saveReport(runId: string, report: Report): Promise<void>;
  saveActuals(runId: string, actuals: ActualOutcomes): Promise<void>;
  saveDiagnostics(runId: string, diagnostics: RunDiagnostics): Promise<void>;
  saveReceipt(runId: string, receipt: ChainReceipt): Promise<void>;
  savePersonaSnapshots(runId: string, snapshots: PersonaSnapshots): Promise<void>;
  saveLaunchReadiness(runId: string, readiness: LaunchReadiness): Promise<void>;
  saveLaunchInput(runId: string, input: NadLaunchInput): Promise<void>;
  saveLaunchRecord(runId: string, record: LaunchRecord): Promise<void>;
  // Report lifecycle methods
  saveReportLifecycle(runId: string, lifecycle: ReportLifecycle): Promise<void>;
  getReportLifecycle(runId: string): Promise<ReportLifecycle | null>;
  appendReportRevision(runId: string, revision: ReportRevision): Promise<void>;
  getReportRevisions(runId: string): Promise<ReportRevision[]>;
  getCalibrationPrior(key: string): Promise<CalibrationPrior | null>;
  saveCalibrationPrior(prior: CalibrationPrior): Promise<void>;
  listRuns(limit?: number): Promise<Run[]>;
  close(): Promise<void>;
}
