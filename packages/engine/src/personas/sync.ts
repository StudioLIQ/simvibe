#!/usr/bin/env tsx
/**
 * personas:sync — Upsert the repo persona pack into Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm personas:sync
 *   DATABASE_URL=postgres://... pnpm personas:sync --deprecate-missing
 *
 * Options:
 *   --deprecate-missing  Mark personas not in files as deprecated
 *   --dry-run           Show what would be synced without writing
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { parsePersonaDoc, type PersonaEngineFields } from './parser';
import { upsertPersona, deprecateMissing, computeVersionHash } from './db-registry';
import { runMigrations } from '../storage/migrate';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    console.error('Error: DATABASE_URL must be a Postgres connection string');
    console.error('Usage: DATABASE_URL=postgres://... pnpm personas:sync');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const deprecateMissingFlag = args.includes('--deprecate-missing');
  const dryRun = args.includes('--dry-run');

  // Find personas directory
  const possiblePaths = [
    path.resolve(process.cwd(), 'personas'),
    path.resolve(__dirname, '../../../../personas'),
    path.resolve(__dirname, '../../../../../personas'),
  ];

  let personasDir: string | null = null;
  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      personasDir = dir;
      break;
    }
  }

  if (!personasDir) {
    console.error('Error: personas/ directory not found');
    process.exit(1);
  }

  console.log(`Syncing personas from ${personasDir}`);
  if (dryRun) {
    console.log('(DRY RUN — no changes will be written)');
  }

  // Parse all persona files
  const files = fs.readdirSync(personasDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  const parsed: { fields: PersonaEngineFields; format: string; filename: string }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    const filePath = path.join(personasDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parsePersonaDoc(content, file);

    if (result.success && result.data) {
      parsed.push({
        fields: result.data,
        format: result.format || 'unknown',
        filename: file,
      });
    } else {
      errors.push({ filename: file, error: result.error || 'Unknown error' });
    }
  }

  console.log(`\nParsed: ${parsed.length} valid, ${errors.length} invalid out of ${files.length} files`);

  if (errors.length > 0) {
    console.log(`\nParse errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) {
      console.log(`  - ${e.filename}: ${e.error}`);
    }
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log(`\nWould sync ${parsed.length} personas into Postgres.`);
    for (const p of parsed.slice(0, 10)) {
      const hash = computeVersionHash(p.fields);
      console.log(`  ${p.fields.id} (${p.format}, hash: ${hash})`);
    }
    if (parsed.length > 10) {
      console.log(`  ... and ${parsed.length - 10} more`);
    }
    if (deprecateMissingFlag) {
      console.log(`Would mark personas not in files as deprecated.`);
    }
    process.exit(0);
  }

  // Connect to Postgres and sync
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Ensure migrations are applied
    await runMigrations(pool);

    let upserted = 0;
    for (const p of parsed) {
      await upsertPersona(pool, p.fields, p.format, { source_file: p.filename });
      upserted++;
    }

    console.log(`\nUpserted: ${upserted} personas`);

    if (deprecateMissingFlag) {
      const activeIds = parsed.map(p => p.fields.id);
      const deprecatedCount = await deprecateMissing(pool, activeIds);
      console.log(`Deprecated: ${deprecatedCount} personas not found in files`);
    }

    // Summary
    const { rows: [counts] } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'deprecated') as deprecated,
        COUNT(*) as total
       FROM personas`
    );
    console.log(`\nDB state: ${counts.active} active, ${counts.deprecated} deprecated, ${counts.total} total`);

  } finally {
    await pool.end();
  }

  console.log('\nSync complete.');
}

main().catch(error => {
  console.error('Sync failed:', error);
  process.exit(1);
});
