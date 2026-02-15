export * from './types';
export { MemoryStorage } from './memory';
export { runMigrations } from './migrate';

import type { Storage } from './types';
import { MemoryStorage } from './memory';

declare const require: NodeJS.Require;

function requirePostgresModule(): typeof import('./postgres') {
  return require('./postgres') as typeof import('./postgres');
}

function requireSQLiteModule(): typeof import('./sqlite') {
  return require('./sqlite') as typeof import('./sqlite');
}

function requireStorageModule<T>(loader: () => T): T {
  // Use runtime require to avoid eagerly loading native modules in environments
  // that do not need them (e.g., memory:// mode). Keep literal requires so
  // Next.js can still trace and bundle these modules for server routes.
  return loader();
}

const MEMORY_SINGLETON_KEY = '__simvibe_memory_storage_singleton__';

function getMemorySingleton(): MemoryStorage {
  const scope = globalThis as typeof globalThis & {
    [MEMORY_SINGLETON_KEY]?: MemoryStorage;
  };

  if (!scope[MEMORY_SINGLETON_KEY]) {
    scope[MEMORY_SINGLETON_KEY] = new MemoryStorage();
  }

  return scope[MEMORY_SINGLETON_KEY]!;
}

export interface StorageConfig {
  type: 'memory' | 'sqlite' | 'postgres';
  sqlitePath?: string;
  postgresUrl?: string;
}

let _activeBackend: string = 'none';

export function getActiveStorageBackend(): string {
  return _activeBackend;
}

export function createStorage(config: StorageConfig): Storage {
  switch (config.type) {
    case 'postgres': {
      if (!config.postgresUrl) {
        throw new Error('Postgres storage requires postgresUrl (DATABASE_URL)');
      }
      try {
        const { PostgresStorage } = requireStorageModule(requirePostgresModule);
        _activeBackend = 'postgres';
        return new PostgresStorage(config.postgresUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to load Postgres storage driver: ${msg}. ` +
          `Ensure 'pg' is installed: pnpm add pg`
        );
      }
    }
    case 'sqlite': {
      if (!config.sqlitePath) {
        throw new Error('SQLite storage requires sqlitePath');
      }
      try {
        const { SQLiteStorage } = requireStorageModule(requireSQLiteModule);
        _activeBackend = 'sqlite';
        return new SQLiteStorage(config.sqlitePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const nodeVersion = process.version;

        // Check if it's a native module issue
        if (msg.includes('better-sqlite3') || msg.includes('MODULE_NOT_FOUND') || msg.includes('native')) {
          console.warn(
            `[storage] SQLite native module failed (Node ${nodeVersion}): ${msg}\n` +
            `  Falling back to in-memory storage.\n` +
            `  To fix: pnpm rebuild better-sqlite3\n` +
            `  Or set DATABASE_URL=memory:// to use in-memory mode explicitly.\n` +
            `  Or set DATABASE_URL=postgres://... for production.`
          );
          _activeBackend = 'memory (fallback from sqlite)';
          return getMemorySingleton();
        }

        throw new Error(
          `Failed to initialize SQLite storage at '${config.sqlitePath}': ${msg}. ` +
          `Node version: ${nodeVersion}. ` +
          `Try: pnpm rebuild better-sqlite3 — or use DATABASE_URL=memory:// for dev`
        );
      }
    }
    case 'memory':
    default:
      _activeBackend = 'memory';
      return getMemorySingleton();
  }
}

/**
 * Determine storage config from DATABASE_URL environment variable.
 * - memory:// (or "memory") -> in-memory store
 * - postgres:// or postgresql:// -> Postgres
 * - file: prefix or path -> SQLite
 * - undefined -> SQLite default
 */
export function storageConfigFromEnv(): StorageConfig {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl === 'memory' || dbUrl === 'memory://' || dbUrl === 'inmemory') {
    return { type: 'memory' };
  }

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    return { type: 'postgres', postgresUrl: dbUrl };
  }

  const sqlitePath = dbUrl?.replace('file:', '') || './data/simvibe.db';
  return { type: 'sqlite', sqlitePath };
}
