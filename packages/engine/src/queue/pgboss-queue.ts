import PgBoss from 'pg-boss';
import type { JobQueue, JobHandler, RunExecutePayload, EnqueueOptions, Job } from './types';

const DEFAULT_RETRY_LIMIT = 2;
const DEFAULT_EXPIRE_SECONDS = 600; // 10 minutes

export class PgBossJobQueue implements JobQueue {
  private boss: PgBoss;

  constructor(connectionString: string) {
    this.boss = new PgBoss({
      connectionString,
      retryLimit: DEFAULT_RETRY_LIMIT,
      expireInSeconds: DEFAULT_EXPIRE_SECONDS,
      archiveCompletedAfterSeconds: 86400, // 1 day
      deleteAfterDays: 7,
      monitorStateIntervalSeconds: 30,
    });

    this.boss.on('error', (error) => {
      console.error('[pgboss] Error:', error.message);
    });
  }

  async start(): Promise<void> {
    await this.boss.start();
    console.log('[pgboss] Started');
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 30000 });
    console.log('[pgboss] Stopped');
  }

  async enqueue(
    name: string,
    data: RunExecutePayload,
    options?: EnqueueOptions
  ): Promise<string | null> {
    const jobId = await this.boss.send(name, data, {
      retryLimit: options?.retryLimit ?? DEFAULT_RETRY_LIMIT,
      retryDelay: options?.retryDelay ?? 5,
      expireInSeconds: options?.expireInSeconds ?? DEFAULT_EXPIRE_SECONDS,
    });

    return jobId;
  }

  async work(name: string, handler: JobHandler<RunExecutePayload>): Promise<void> {
    await this.boss.work<RunExecutePayload>(
      name,
      { batchSize: 1 },
      async (jobs) => {
        // batchSize=1 so we always get exactly one job
        for (const pgbossJob of jobs) {
          const job: Job<RunExecutePayload> = {
            id: pgbossJob.id,
            name: pgbossJob.name,
            data: pgbossJob.data,
            createdon: new Date(),
          };
          await handler(job);
        }
      }
    );
  }
}
