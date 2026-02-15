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
} from '@simvibe/shared';
import type { Storage, Run, RunStatus } from './types';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT NOT NULL,
    landing_extract TEXT,
    report TEXT,
    actuals TEXT,
    diagnostics TEXT,
    receipt TEXT,
    persona_snapshots TEXT,
    variant_of TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE TABLE IF NOT EXISTS agent_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    data TEXT NOT NULL,
    UNIQUE(run_id, persona_id),
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE TABLE IF NOT EXISTS calibration_priors (
    key TEXT PRIMARY KEY,
    signup_multiplier REAL NOT NULL DEFAULT 1.0,
    pay_multiplier REAL NOT NULL DEFAULT 1.0,
    bounce_multiplier REAL NOT NULL DEFAULT 1.0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
  CREATE INDEX IF NOT EXISTS idx_agent_outputs_run_id ON agent_outputs(run_id);
  CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
`;

export class SQLiteStorage implements Storage {
  private db: import('better-sqlite3').Database;

  private static loadSqlite(): typeof import('better-sqlite3') {
    // Avoid bundler static-analysis issues (Next.js app routes + native module).
    // eslint-disable-next-line no-eval
    const nodeRequire = eval('require') as NodeJS.Require;
    return nodeRequire('better-sqlite3');
  }

  constructor(dbPath: string) {
    const Database = SQLiteStorage.loadSqlite();
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(INIT_SQL);
    this.migrateSchema();
  }

  /**
   * Apply incremental schema migrations for existing databases.
   */
  private migrateSchema(): void {
    const columns = this.db.pragma('table_info(runs)') as { name: string }[];
    const colNames = new Set(columns.map(c => c.name));

    // Add persona_snapshots column if missing (SIM-022)
    if (!colNames.has('persona_snapshots')) {
      this.db.exec('ALTER TABLE runs ADD COLUMN persona_snapshots TEXT');
    }
    // Add nad launch columns if missing (SIM-036)
    if (!colNames.has('launch_readiness')) {
      this.db.exec('ALTER TABLE runs ADD COLUMN launch_readiness TEXT');
    }
    if (!colNames.has('launch_input')) {
      this.db.exec('ALTER TABLE runs ADD COLUMN launch_input TEXT');
    }
    if (!colNames.has('launch_record')) {
      this.db.exec('ALTER TABLE runs ADD COLUMN launch_record TEXT');
    }
  }

  async createRun(input: RunInput): Promise<Run> {
    const now = new Date().toISOString();
    const id = `run_${nanoid(12)}`;

    this.db.prepare(`
      INSERT INTO runs (id, created_at, updated_at, status, input)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(id, now, now, JSON.stringify(input));

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
    const row = this.db.prepare(`
      SELECT * FROM runs WHERE id = ?
    `).get(runId) as {
      id: string;
      created_at: string;
      updated_at: string;
      status: RunStatus;
      input: string;
      landing_extract: string | null;
      report: string | null;
      actuals: string | null;
      diagnostics: string | null;
      receipt: string | null;
      persona_snapshots: string | null;
      launch_readiness: string | null;
      launch_input: string | null;
      launch_record: string | null;
      variant_of: string | null;
      error: string | null;
    } | undefined;

    if (!row) {
      return null;
    }

    const events = this.db.prepare(`
      SELECT data FROM events WHERE run_id = ? ORDER BY timestamp
    `).all(runId) as { data: string }[];

    const agentOutputs = this.db.prepare(`
      SELECT data FROM agent_outputs WHERE run_id = ?
    `).all(runId) as { data: string }[];

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      input: JSON.parse(row.input),
      landingExtract: row.landing_extract ? JSON.parse(row.landing_extract) : undefined,
      report: row.report ? JSON.parse(row.report) : undefined,
      actuals: row.actuals ? JSON.parse(row.actuals) : undefined,
      diagnostics: row.diagnostics ? JSON.parse(row.diagnostics) : undefined,
      receipt: row.receipt ? JSON.parse(row.receipt) : undefined,
      personaSnapshots: row.persona_snapshots ? JSON.parse(row.persona_snapshots) : undefined,
      launchReadiness: row.launch_readiness ? JSON.parse(row.launch_readiness) : undefined,
      launchInput: row.launch_input ? JSON.parse(row.launch_input) : undefined,
      launchRecord: row.launch_record ? JSON.parse(row.launch_record) : undefined,
      variantOf: row.variant_of ?? undefined,
      error: row.error ?? undefined,
      events: events.map((e) => JSON.parse(e.data)),
      agentOutputs: agentOutputs.map((a) => JSON.parse(a.data)),
    };
  }

  async getRunStatus(runId: string): Promise<RunStatus | null> {
    const row = this.db.prepare(`
      SELECT status FROM runs WHERE id = ?
    `).get(runId) as { status: RunStatus } | undefined;

    return row?.status ?? null;
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET status = ?, updated_at = ?, error = ? WHERE id = ?
    `).run(status, now, error ?? null, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveLandingExtract(runId: string, extract: LandingExtract): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET landing_extract = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(extract), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async appendEvent(runId: string, event: SimEvent): Promise<void> {
    this.db.prepare(`
      INSERT INTO events (id, run_id, timestamp, data)
      VALUES (?, ?, ?, ?)
    `).run(event.id, runId, event.timestamp, JSON.stringify(event));

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE runs SET updated_at = ? WHERE id = ?
    `).run(now, runId);
  }

  async getEventsSince(runId: string, sinceId?: string): Promise<SimEvent[]> {
    if (sinceId) {
      // Get the timestamp of the cursor event
      const cursorRow = this.db.prepare(`
        SELECT timestamp FROM events WHERE id = ? AND run_id = ?
      `).get(sinceId, runId) as { timestamp: string } | undefined;

      if (cursorRow) {
        const rows = this.db.prepare(`
          SELECT data FROM events
          WHERE run_id = ? AND timestamp > ?
          ORDER BY timestamp
        `).all(runId, cursorRow.timestamp) as { data: string }[];

        return rows.map(r => JSON.parse(r.data));
      }
    }

    // No cursor or cursor not found: return all events
    const rows = this.db.prepare(`
      SELECT data FROM events WHERE run_id = ? ORDER BY timestamp
    `).all(runId) as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
  }

  async saveAgentOutput(runId: string, output: AgentOutput): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO agent_outputs (run_id, persona_id, data)
      VALUES (?, ?, ?)
    `).run(runId, output.personaId, JSON.stringify(output));

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE runs SET updated_at = ? WHERE id = ?
    `).run(now, runId);
  }

  async saveReport(runId: string, report: Report): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET report = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(report), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveActuals(runId: string, actuals: ActualOutcomes): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET actuals = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(actuals), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveDiagnostics(runId: string, diagnostics: RunDiagnostics): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET diagnostics = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(diagnostics), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveReceipt(runId: string, receipt: ChainReceipt): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET receipt = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(receipt), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async savePersonaSnapshots(runId: string, snapshots: PersonaSnapshots): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET persona_snapshots = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(snapshots), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveLaunchReadiness(runId: string, readiness: LaunchReadiness): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET launch_readiness = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(readiness), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveLaunchInput(runId: string, input: NadLaunchInput): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET launch_input = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(input), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async saveLaunchRecord(runId: string, record: LaunchRecord): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs SET launch_record = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(record), now, runId);

    if (result.changes === 0) {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  async getCalibrationPrior(key: string): Promise<CalibrationPrior | null> {
    const row = this.db.prepare(`
      SELECT * FROM calibration_priors WHERE key = ?
    `).get(key) as {
      key: string;
      signup_multiplier: number;
      pay_multiplier: number;
      bounce_multiplier: number;
      sample_count: number;
      last_updated: string;
    } | undefined;

    if (!row) {
      return null;
    }

    return {
      key: row.key,
      signupMultiplier: row.signup_multiplier,
      payMultiplier: row.pay_multiplier,
      bounceMultiplier: row.bounce_multiplier,
      sampleCount: row.sample_count,
      lastUpdated: row.last_updated,
    };
  }

  async saveCalibrationPrior(prior: CalibrationPrior): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO calibration_priors (key, signup_multiplier, pay_multiplier, bounce_multiplier, sample_count, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      prior.key,
      prior.signupMultiplier,
      prior.payMultiplier,
      prior.bounceMultiplier,
      prior.sampleCount,
      prior.lastUpdated
    );
  }

  async listRuns(limit = 100): Promise<Run[]> {
    const rows = this.db.prepare(`
      SELECT id FROM runs ORDER BY created_at DESC LIMIT ?
    `).all(limit) as { id: string }[];

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
    this.db.close();
  }
}
