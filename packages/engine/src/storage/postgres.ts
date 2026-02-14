import { Pool, type PoolConfig } from 'pg';
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
} from '@simvibe/shared';
import type { Storage, Run, RunStatus } from './types';
import { runMigrations } from './migrate';

export class PostgresStorage implements Storage {
  private pool: Pool;
  private migrated = false;

  constructor(connectionString: string, poolConfig?: Partial<PoolConfig>) {
    this.pool = new Pool({
      connectionString,
      max: poolConfig?.max ?? 10,
      idleTimeoutMillis: poolConfig?.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: poolConfig?.connectionTimeoutMillis ?? 5000,
      ...poolConfig,
    });
  }

  async ensureMigrations(): Promise<void> {
    if (this.migrated) return;
    await runMigrations(this.pool);
    this.migrated = true;
  }

  async createRun(input: RunInput): Promise<Run> {
    const now = new Date().toISOString();
    const id = `run_${nanoid(12)}`;

    await this.pool.query(
      `INSERT INTO runs (id, created_at, updated_at, status, input)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [id, now, now, JSON.stringify(input)]
    );

    return {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      input,
      agentOutputs: [],
      events: [],
    };
  }

  async getRun(runId: string): Promise<Run | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM runs WHERE id = $1`,
      [runId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    const { rows: eventRows } = await this.pool.query(
      `SELECT data FROM events WHERE run_id = $1 ORDER BY timestamp`,
      [runId]
    );

    const { rows: outputRows } = await this.pool.query(
      `SELECT data FROM agent_outputs WHERE run_id = $1`,
      [runId]
    );

    return {
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      status: row.status as RunStatus,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      landingExtract: row.landing_extract
        ? (typeof row.landing_extract === 'string' ? JSON.parse(row.landing_extract) : row.landing_extract)
        : undefined,
      report: row.report
        ? (typeof row.report === 'string' ? JSON.parse(row.report) : row.report)
        : undefined,
      actuals: row.actuals
        ? (typeof row.actuals === 'string' ? JSON.parse(row.actuals) : row.actuals)
        : undefined,
      diagnostics: row.diagnostics
        ? (typeof row.diagnostics === 'string' ? JSON.parse(row.diagnostics) : row.diagnostics)
        : undefined,
      receipt: row.receipt
        ? (typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt)
        : undefined,
      variantOf: row.variant_of ?? undefined,
      error: row.error ?? undefined,
      events: eventRows.map((e) =>
        typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      ),
      agentOutputs: outputRows.map((a) =>
        typeof a.data === 'string' ? JSON.parse(a.data) : a.data
      ),
    };
  }

  async getRunStatus(runId: string): Promise<RunStatus | null> {
    const { rows } = await this.pool.query(
      `SELECT status FROM runs WHERE id = $1`,
      [runId]
    );
    return rows.length > 0 ? (rows[0].status as RunStatus) : null;
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET status = $1, updated_at = $2, error = $3 WHERE id = $4`,
      [status, now, error ?? null, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveLandingExtract(runId: string, extract: LandingExtract): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET landing_extract = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(extract), now, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async appendEvent(runId: string, event: SimEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO events (id, run_id, timestamp, data)
       VALUES ($1, $2, $3, $4)`,
      [event.id, runId, event.timestamp, JSON.stringify(event)]
    );

    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE runs SET updated_at = $1 WHERE id = $2`,
      [now, runId]
    );
  }

  async getEventsSince(runId: string, sinceId?: string): Promise<SimEvent[]> {
    if (sinceId) {
      const { rows: cursorRows } = await this.pool.query(
        `SELECT timestamp FROM events WHERE id = $1 AND run_id = $2`,
        [sinceId, runId]
      );

      if (cursorRows.length > 0) {
        const cursorTs = cursorRows[0].timestamp;
        const { rows } = await this.pool.query(
          `SELECT data FROM events
           WHERE run_id = $1 AND timestamp > $2
           ORDER BY timestamp`,
          [runId, cursorTs]
        );
        return rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      }
    }

    const { rows } = await this.pool.query(
      `SELECT data FROM events WHERE run_id = $1 ORDER BY timestamp`,
      [runId]
    );
    return rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
  }

  async saveAgentOutput(runId: string, output: AgentOutput): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_outputs (run_id, persona_id, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (run_id, persona_id) DO UPDATE SET data = EXCLUDED.data`,
      [runId, output.personaId, JSON.stringify(output)]
    );

    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE runs SET updated_at = $1 WHERE id = $2`,
      [now, runId]
    );
  }

  async saveReport(runId: string, report: Report): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET report = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(report), now, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveActuals(runId: string, actuals: ActualOutcomes): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET actuals = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(actuals), now, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveDiagnostics(runId: string, diagnostics: RunDiagnostics): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET diagnostics = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(diagnostics), now, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveReceipt(runId: string, receipt: ChainReceipt): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `UPDATE runs SET receipt = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(receipt), now, runId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async getCalibrationPrior(key: string): Promise<CalibrationPrior | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM calibration_priors WHERE key = $1`,
      [key]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      key: row.key,
      signupMultiplier: row.signup_multiplier,
      payMultiplier: row.pay_multiplier,
      bounceMultiplier: row.bounce_multiplier,
      sampleCount: row.sample_count,
      lastUpdated: row.last_updated instanceof Date
        ? row.last_updated.toISOString()
        : row.last_updated,
    };
  }

  async saveCalibrationPrior(prior: CalibrationPrior): Promise<void> {
    await this.pool.query(
      `INSERT INTO calibration_priors (key, signup_multiplier, pay_multiplier, bounce_multiplier, sample_count, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET
         signup_multiplier = EXCLUDED.signup_multiplier,
         pay_multiplier = EXCLUDED.pay_multiplier,
         bounce_multiplier = EXCLUDED.bounce_multiplier,
         sample_count = EXCLUDED.sample_count,
         last_updated = EXCLUDED.last_updated`,
      [
        prior.key,
        prior.signupMultiplier,
        prior.payMultiplier,
        prior.bounceMultiplier,
        prior.sampleCount,
        prior.lastUpdated,
      ]
    );
  }

  async listRuns(limit = 100): Promise<Run[]> {
    const { rows } = await this.pool.query(
      `SELECT id FROM runs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    const runs: Run[] = [];
    for (const row of rows) {
      const run = await this.getRun(row.id);
      if (run) {
        runs.push(run);
      }
    }
    return runs;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
