import { nanoid } from 'nanoid';
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
  ReportLifecycle,
  ReportRevision,
} from '@simvibe/shared';
import type { Storage, Run, RunStatus } from './types';

export class MemoryStorage implements Storage {
  private runs: Map<string, Run> = new Map();
  private calibrationPriors: Map<string, CalibrationPrior> = new Map();

  async createRun(input: RunInput): Promise<Run> {
    const now = new Date().toISOString();
    const run: Run = {
      id: `run_${nanoid(12)}`,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      input,
      agentOutputs: [],
      events: [],
    };
    this.runs.set(run.id, run);
    return run;
  }

  async getRun(runId: string): Promise<Run | null> {
    return this.runs.get(runId) ?? null;
  }

  async getRunStatus(runId: string): Promise<RunStatus | null> {
    const run = this.runs.get(runId);
    return run?.status ?? null;
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.status = status;
    run.updatedAt = new Date().toISOString();
    if (error) {
      run.error = error;
    }
  }

  async saveLandingExtract(runId: string, extract: LandingExtract): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.landingExtract = extract;
    run.updatedAt = new Date().toISOString();
  }

  async appendEvent(runId: string, event: SimEvent): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.events.push(event);
    run.updatedAt = new Date().toISOString();
  }

  async getEventsSince(runId: string, sinceId?: string): Promise<SimEvent[]> {
    const run = this.runs.get(runId);
    if (!run) {
      return [];
    }

    if (sinceId) {
      const idx = run.events.findIndex(e => e.id === sinceId);
      if (idx >= 0) {
        return run.events.slice(idx + 1);
      }
    }

    return [...run.events];
  }

  async saveAgentOutput(runId: string, output: AgentOutput): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    const existingIndex = run.agentOutputs.findIndex(
      (o) => o.personaId === output.personaId
    );
    if (existingIndex >= 0) {
      run.agentOutputs[existingIndex] = output;
    } else {
      run.agentOutputs.push(output);
    }
    run.updatedAt = new Date().toISOString();
  }

  async saveReport(runId: string, report: Report): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.report = report;
    run.updatedAt = new Date().toISOString();
  }

  async saveActuals(runId: string, actuals: ActualOutcomes): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.actuals = actuals;
    run.updatedAt = new Date().toISOString();
  }

  async saveDiagnostics(runId: string, diagnostics: RunDiagnostics): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.diagnostics = diagnostics;
    run.updatedAt = new Date().toISOString();
  }

  async saveReceipt(runId: string, receipt: ChainReceipt): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.receipt = receipt;
    run.receiptTxHash = receipt.txHash;
    run.receiptContract = receipt.contractAddress;
    run.receiptChainId = receipt.chainId;
    run.receiptPublishedAt = receipt.timestamp;
    run.updatedAt = new Date().toISOString();
  }

  async savePersonaSnapshots(runId: string, snapshots: PersonaSnapshots): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.personaSnapshots = snapshots;
    run.updatedAt = new Date().toISOString();
  }

  async saveLaunchReadiness(runId: string, readiness: LaunchReadiness): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.launchReadiness = readiness;
    run.updatedAt = new Date().toISOString();
  }

  async saveLaunchInput(runId: string, input: NadLaunchInput): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.launchInput = input;
    run.updatedAt = new Date().toISOString();
  }

  async saveLaunchRecord(runId: string, record: LaunchRecord): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.launchRecord = record;
    run.launchTxHash = record.txHash;
    run.tokenContractAddress = record.tokenAddress;
    if (record.status === 'success' && !run.launchConfirmedAt) {
      run.launchConfirmedAt = new Date().toISOString();
    }
    run.updatedAt = new Date().toISOString();
  }

  async saveReportLifecycle(runId: string, lifecycle: ReportLifecycle): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    run.reportLifecycle = lifecycle;
    run.reportStatus = lifecycle.status;
    run.reportVersion = lifecycle.version;
    run.updatedAt = new Date().toISOString();
  }

  async getReportLifecycle(runId: string): Promise<ReportLifecycle | null> {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }
    return run.reportLifecycle ?? null;
  }

  async appendReportRevision(runId: string, revision: ReportRevision): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    if (!run.reportRevisions) {
      run.reportRevisions = [];
    }
    run.reportRevisions.push(revision);
    run.updatedAt = new Date().toISOString();
  }

  async getReportRevisions(runId: string): Promise<ReportRevision[]> {
    const run = this.runs.get(runId);
    if (!run) {
      return [];
    }
    return run.reportRevisions ?? [];
  }

  async getCalibrationPrior(key: string): Promise<CalibrationPrior | null> {
    return this.calibrationPriors.get(key) ?? null;
  }

  async saveCalibrationPrior(prior: CalibrationPrior): Promise<void> {
    this.calibrationPriors.set(prior.key, prior);
  }

  async listRuns(limit = 100): Promise<Run[]> {
    const runs = Array.from(this.runs.values());
    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return runs.slice(0, limit);
  }

  async close(): Promise<void> {
    // No-op for memory storage
  }
}
