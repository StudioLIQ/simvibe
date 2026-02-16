import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_TABLE = '_migrations';
const MIGRATIONS_DIR_ENV = 'SIMVIBE_MIGRATIONS_DIR';

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function isReadableDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function resolveMigrationsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    process.env[MIGRATIONS_DIR_ENV],
    path.join(__dirname, 'migrations'),
    path.join(cwd, 'packages', 'engine', 'src', 'storage', 'migrations'),
    path.join(cwd, 'node_modules', '@simvibe', 'engine', 'src', 'storage', 'migrations'),
    path.join(cwd, 'dist', 'storage', 'migrations'),
  ].filter((value): value is string => Boolean(value));

  for (const dirPath of candidates) {
    if (isReadableDirectory(dirPath)) {
      return dirPath;
    }
  }

  const attempted = candidates.map((value) => `- ${value}`).join('\n');
  throw new Error(
    `Unable to locate SQL migrations directory.\n` +
      `Set ${MIGRATIONS_DIR_ENV} or ensure one of these paths exists:\n${attempted}`,
  );
}

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query(CREATE_MIGRATIONS_TABLE);

    const { rows: existing } = await client.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`
    );
    const appliedSet = new Set(existing.map((r: { name: string }) => r.name));

    const migrationsDir = resolveMigrationsDir();
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
          [file]
        );
        await client.query('COMMIT');
        applied.push(file);
        console.log(`Migration applied: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (applied.length === 0) {
      console.log('All migrations already applied');
    }

    return applied;
  } finally {
    client.release();
  }
}
