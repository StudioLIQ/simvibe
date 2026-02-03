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
