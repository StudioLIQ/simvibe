#!/usr/bin/env tsx
/**
 * CLI script to run Postgres migrations.
 * Usage: DATABASE_URL=postgres://... pnpm --filter @simvibe/engine db:migrate
 */

import { Pool } from 'pg';
import { runMigrations } from './migrate';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
    console.error('Error: DATABASE_URL must be a postgres:// URL');
    console.error('Usage: DATABASE_URL=postgres://user:pass@host:5432/simvibe pnpm db:migrate');
    process.exit(1);
  }

  console.log('Running migrations...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const applied = await runMigrations(pool);
    if (applied.length > 0) {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    } else {
      console.log('Database is up to date.');
    }
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
