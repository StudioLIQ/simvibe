export * from './types';
export { PgBossJobQueue } from './pgboss-queue';
export { InlineJobQueue } from './inline-queue';

import type { JobQueue, JobQueueConfig } from './types';
import { PgBossJobQueue } from './pgboss-queue';
import { InlineJobQueue } from './inline-queue';

export function createJobQueue(config: JobQueueConfig): JobQueue {
  switch (config.type) {
    case 'pgboss':
      if (!config.postgresUrl) {
        throw new Error('PgBoss queue requires postgresUrl');
      }
      return new PgBossJobQueue(config.postgresUrl);
    case 'inline':
    default:
      return new InlineJobQueue();
  }
}

/**
 * Determine queue config from DATABASE_URL environment variable.
 * Uses pg-boss when Postgres is configured, inline otherwise.
 */
export function queueConfigFromEnv(): JobQueueConfig {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    return { type: 'pgboss', postgresUrl: dbUrl };
  }

  return { type: 'inline' };
}
