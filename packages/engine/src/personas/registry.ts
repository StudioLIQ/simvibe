import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { parsePersonaDoc, type PersonaEngineFields, type ParseResult } from './parser';
import { loadPersonasFromDb } from './db-registry';
import type { PersonaDefinition } from '../prompts/personas';

/**
 * PersonaRegistry: runtime store of persona definitions loaded from markdown files or Postgres.
 * This is the single source of truth for persona data at runtime.
 */
export class PersonaRegistry {
  private personas: Map<string, PersonaDefinition> = new Map();
  private parseErrors: ParseResult[] = [];
  private _source: 'db' | 'files' | 'empty' = 'empty';

  get size(): number {
    return this.personas.size;
  }

  get errors(): ParseResult[] {
    return this.parseErrors;
  }

  get source(): 'db' | 'files' | 'empty' {
    return this._source;
  }

  get(id: string): PersonaDefinition | undefined {
    return this.personas.get(id);
  }

  has(id: string): boolean {
    return this.personas.has(id);
  }

  getAllIds(): string[] {
    return Array.from(this.personas.keys());
  }

  getAll(): PersonaDefinition[] {
    return Array.from(this.personas.values());
  }

  /**
   * Register a single persona (from parsed engine fields).
   */
  register(fields: PersonaEngineFields): void {
    this.personas.set(fields.id, {
      id: fields.id as PersonaDefinition['id'],
      name: fields.name,
      role: fields.role,
      context: fields.context,
      priorities: fields.priorities,
      redFlags: fields.redFlags,
      budgetRange: fields.budgetRange,
      skepticismLevel: fields.skepticismLevel,
      decisionStyle: fields.decisionStyle,
      cryptoInvestmentExperience: fields.cryptoInvestmentExperience,
      degenLevel: fields.degenLevel,
    });
  }

  /**
   * Load all persona markdown files from a directory.
   * Supports both YAML frontmatter and legacy "## 10) Engine Mapping" formats.
   * Returns the number of successfully loaded personas.
   */
  loadFromDirectory(dirPath: string): number {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[persona-registry] Directory not found: ${dirPath}`);
      return 0;
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md'))
      .sort();

    let loaded = 0;
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parsePersonaDoc(content, file);

      if (result.success && result.data) {
        this.register(result.data);
        loaded++;
      } else {
        this.parseErrors.push(result);
      }
    }

    if (loaded > 0) {
      this._source = 'files';
    }

    return loaded;
  }

  /**
   * Load personas from Postgres database.
   * Returns the number of successfully loaded personas.
   */
  async loadFromDb(pool: Pool): Promise<number> {
    const dbPersonas = await loadPersonasFromDb(pool);

    for (const [id, def] of dbPersonas) {
      this.personas.set(id, def);
    }

    if (dbPersonas.size > 0) {
      this._source = 'db';
    }

    return dbPersonas.size;
  }
}

// Global singleton registry
let _globalRegistry: PersonaRegistry | null = null;
let _registryLoadedAt: number = 0;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the global persona registry, loading from Postgres (if available) or the
 * personas/ directory. Caches for CACHE_TTL_MS.
 *
 * Priority:
 *   1. Postgres (if DATABASE_URL is set and DB has active personas)
 *   2. Persona pack files (personas/*.md)
 */
export function getPersonaRegistry(): PersonaRegistry {
  const now = Date.now();

  // Return cached registry if within TTL
  if (_globalRegistry && (now - _registryLoadedAt) < CACHE_TTL_MS) {
    return _globalRegistry;
  }

  _globalRegistry = new PersonaRegistry();
  _registryLoadedAt = now;

  // Try Postgres first (synchronous check — async load is deferred)
  // Note: DB loading is async, so for synchronous access we rely on
  // priming via initPersonaRegistryFromDb() at startup, or fall through to files.

  // File-based loading (synchronous fallback)
  const configuredDir = process.env.PERSONAS_DIR;
  const possiblePaths = [
    configuredDir ? path.resolve(configuredDir) : '',
    path.resolve(process.cwd(), 'personas'),
    path.resolve(process.cwd(), '../personas'),
    path.resolve(process.cwd(), '../../personas'),
    path.resolve(__dirname, '../../../../personas'),
    path.resolve(__dirname, '../../../../../personas'),
    path.resolve(__dirname, '../../../../../../personas'),
  ].filter(Boolean);

  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      const loaded = _globalRegistry.loadFromDirectory(dir);
      if (loaded > 0) {
        console.log(`[persona-registry] Loaded ${loaded} personas from ${dir}`);
        if (_globalRegistry.errors.length > 0) {
          console.warn(`[persona-registry] ${_globalRegistry.errors.length} persona files failed to parse`);
        }
        return _globalRegistry;
      }
    }
  }

  console.warn(`[persona-registry] No persona directory found. Registry is empty.`);
  return _globalRegistry;
}

/**
 * Initialize the global persona registry from Postgres.
 * Call at worker/service startup to prime the DB-backed registry.
 * Falls back to file-based loading if DB has no active personas.
 */
export async function initPersonaRegistryFromDb(databaseUrl: string): Promise<PersonaRegistry> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 3000,
  });

  try {
    const registry = new PersonaRegistry();
    const dbCount = await registry.loadFromDb(pool);

    if (dbCount > 0) {
      console.log(`[persona-registry] Loaded ${dbCount} personas from Postgres`);
      _globalRegistry = registry;
      _registryLoadedAt = Date.now();
      return registry;
    }

    console.log(`[persona-registry] No personas in DB, falling back to files`);
  } catch (error) {
    console.warn(
      `[persona-registry] DB load failed, falling back to files: ${error instanceof Error ? error.message : error}`
    );
  } finally {
    await pool.end();
  }

  // Fallback to file-based
  return getPersonaRegistry();
}

/**
 * Ensure the global persona registry is loaded, preferring Postgres when DATABASE_URL is set.
 * Safe to call from async contexts (API routes, worker startup). Idempotent within TTL.
 *
 * Priority:
 *   1. Return cached registry if within TTL
 *   2. Try Postgres (if DATABASE_URL starts with postgres://)
 *   3. Fall back to file-based loading
 */
export async function ensurePersonaRegistry(): Promise<PersonaRegistry> {
  const now = Date.now();

  // Return cached registry if within TTL
  if (_globalRegistry && (now - _registryLoadedAt) < CACHE_TTL_MS) {
    return _globalRegistry;
  }

  // Try Postgres if configured
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    try {
      return await initPersonaRegistryFromDb(dbUrl);
    } catch (error) {
      console.warn(
        `[persona-registry] ensurePersonaRegistry: DB init failed, falling back to files: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  // Fall back to synchronous file-based loading
  return getPersonaRegistry();
}

/**
 * Validate that all requested persona IDs exist in the current registry.
 * Returns null if valid, or an error object if invalid.
 */
export function validatePersonaIds(
  personaIds: string[]
): { valid: true } | { valid: false; missing: string[]; available: string[]; total: number } {
  const registry = getPersonaRegistry();
  const missing = personaIds.filter(id => !registry.has(id));

  if (missing.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    missing,
    available: registry.getAllIds().slice(0, 10),
    total: registry.size,
  };
}

/**
 * Reset the global registry (for testing).
 */
export function resetPersonaRegistry(): void {
  _globalRegistry = null;
  _registryLoadedAt = 0;
}
