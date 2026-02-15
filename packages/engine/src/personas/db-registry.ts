import { Pool } from 'pg';
import { createHash } from 'crypto';
import type { PersonaEngineFields } from './parser';
import { PersonaEngineFieldsSchema } from './parser';
import type { PersonaDefinition } from '../prompts/personas';

/**
 * Row shape from the `personas` table.
 */
interface PersonaRow {
  id: string;
  status: string;
  version_hash: string;
  engine_fields: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  source_format: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Compute a deterministic version hash for persona engine fields.
 * Uses canonical JSON (sorted keys) + sha256.
 */
export function computeVersionHash(fields: PersonaEngineFields): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Convert engine fields to a PersonaDefinition.
 */
function toPersonaDefinition(fields: PersonaEngineFields): PersonaDefinition {
  return {
    id: fields.id,
    name: fields.name,
    role: fields.role,
    context: fields.context,
    priorities: fields.priorities,
    redFlags: fields.redFlags,
    budgetRange: fields.budgetRange,
    skepticismLevel: fields.skepticismLevel,
    decisionStyle: fields.decisionStyle,
  };
}

/**
 * Load all active personas from Postgres.
 * Returns a Map of persona ID -> PersonaDefinition.
 */
export async function loadPersonasFromDb(pool: Pool): Promise<Map<string, PersonaDefinition>> {
  const personas = new Map<string, PersonaDefinition>();

  try {
    const { rows } = await pool.query<PersonaRow>(
      `SELECT id, engine_fields FROM personas WHERE status = 'active' ORDER BY id`
    );

    for (const row of rows) {
      const engineFields = typeof row.engine_fields === 'string'
        ? JSON.parse(row.engine_fields)
        : row.engine_fields;

      const parsed = PersonaEngineFieldsSchema.safeParse(engineFields);
      if (parsed.success) {
        personas.set(parsed.data.id, toPersonaDefinition(parsed.data));
      }
    }
  } catch (error) {
    console.warn(
      `[db-registry] Failed to load personas from DB: ${error instanceof Error ? error.message : error}`
    );
  }

  return personas;
}

/**
 * Upsert a single persona into Postgres.
 */
export async function upsertPersona(
  pool: Pool,
  fields: PersonaEngineFields,
  sourceFormat: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const versionHash = computeVersionHash(fields);

  await pool.query(
    `INSERT INTO personas (id, status, version_hash, engine_fields, metadata, source_format, updated_at)
     VALUES ($1, 'active', $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       status = 'active',
       version_hash = EXCLUDED.version_hash,
       engine_fields = EXCLUDED.engine_fields,
       metadata = COALESCE(EXCLUDED.metadata, personas.metadata),
       source_format = EXCLUDED.source_format,
       updated_at = NOW()`,
    [
      fields.id,
      versionHash,
      JSON.stringify(fields),
      metadata ? JSON.stringify(metadata) : null,
      sourceFormat,
    ]
  );
}

/**
 * Mark personas not in the given ID set as deprecated.
 * Returns the count of deprecated personas.
 */
export async function deprecateMissing(pool: Pool, activeIds: string[]): Promise<number> {
  if (activeIds.length === 0) return 0;

  const placeholders = activeIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await pool.query(
    `UPDATE personas SET status = 'deprecated', updated_at = NOW()
     WHERE status = 'active' AND id NOT IN (${placeholders})`,
    activeIds
  );

  return result.rowCount ?? 0;
}

/**
 * Get a persona by ID (any status) for rollback purposes.
 */
export async function getPersonaVersion(
  pool: Pool,
  id: string
): Promise<{ fields: PersonaEngineFields; versionHash: string; status: string } | null> {
  const { rows } = await pool.query<PersonaRow>(
    `SELECT engine_fields, version_hash, status FROM personas WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const engineFields = typeof row.engine_fields === 'string'
    ? JSON.parse(row.engine_fields)
    : row.engine_fields;

  const parsed = PersonaEngineFieldsSchema.safeParse(engineFields);
  if (!parsed.success) return null;

  return {
    fields: parsed.data,
    versionHash: row.version_hash,
    status: row.status,
  };
}

/**
 * Re-activate a deprecated persona by ID.
 */
export async function reactivatePersona(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE personas SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'deprecated'`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
