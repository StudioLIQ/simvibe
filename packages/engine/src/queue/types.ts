export const JOB_RUN_EXECUTE = 'run.execute';

export interface RunExecutePayload {
  runId: string;
  runMode?: 'quick' | 'deep';
}

export interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  createdon: Date;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

export interface JobQueue {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueue(name: string, data: RunExecutePayload, options?: EnqueueOptions): Promise<string | null>;
  work(name: string, handler: JobHandler<RunExecutePayload>): Promise<void>;
}

export interface EnqueueOptions {
  retryLimit?: number;
  retryDelay?: number; // seconds
  expireInSeconds?: number;
}

export interface JobQueueConfig {
  type: 'pgboss' | 'inline';
  postgresUrl?: string;
}
