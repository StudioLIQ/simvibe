export * from './types';
export { MemoryStorage } from './memory';
export { SQLiteStorage } from './sqlite';
export { PostgresStorage } from './postgres';
export { runMigrations } from './migrate';

import type { Storage } from './types';
import { MemoryStorage } from './memory';
import { SQLiteStorage } from './sqlite';
import { PostgresStorage } from './postgres';

export interface StorageConfig {
  type: 'memory' | 'sqlite' | 'postgres';
  sqlitePath?: string;
  postgresUrl?: string;
}

export function createStorage(config: StorageConfig): Storage {
  switch (config.type) {
    case 'postgres':
      if (!config.postgresUrl) {
        throw new Error('Postgres storage requires postgresUrl (DATABASE_URL)');
      }
      return new PostgresStorage(config.postgresUrl);
    case 'sqlite':
      if (!config.sqlitePath) {
        throw new Error('SQLite storage requires sqlitePath');
      }
      return new SQLiteStorage(config.sqlitePath);
    case 'memory':
    default:
      return new MemoryStorage();
  }
}

/**
 * Determine storage config from DATABASE_URL environment variable.
 * - postgres:// or postgresql:// -> Postgres
 * - file: prefix or path -> SQLite
 * - undefined -> SQLite default
 */
export function storageConfigFromEnv(): StorageConfig {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    return { type: 'postgres', postgresUrl: dbUrl };
  }

  const sqlitePath = dbUrl?.replace('file:', '') || './data/simvibe.db';
  return { type: 'sqlite', sqlitePath };
}
