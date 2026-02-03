import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  RunInput,
  LandingExtract,
  AgentOutput,
  SimEvent,
  Report,
  ActualOutcomes,
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

  CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
  CREATE INDEX IF NOT EXISTS idx_agent_outputs_run_id ON agent_outputs(run_id);
  CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
`;

export class SQLiteStorage implements Storage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(INIT_SQL);
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
      variantOf: row.variant_of ?? undefined,
      error: row.error ?? undefined,
      events: events.map((e) => JSON.parse(e.data)),
      agentOutputs: agentOutputs.map((a) => JSON.parse(a.data)),
    };
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
