export * from './types';
export { MemoryStorage } from './memory';
export { SQLiteStorage } from './sqlite';

import type { Storage } from './types';
import { MemoryStorage } from './memory';
import { SQLiteStorage } from './sqlite';

export interface StorageConfig {
  type: 'memory' | 'sqlite';
  sqlitePath?: string;
}

export function createStorage(config: StorageConfig): Storage {
  switch (config.type) {
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
