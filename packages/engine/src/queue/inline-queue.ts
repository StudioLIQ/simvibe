import type { JobQueue, JobHandler, RunExecutePayload, EnqueueOptions, Job } from './types';

/**
 * Inline "queue" that executes nothing on enqueue.
 * Used for SQLite/dev mode where the start route executes inline.
 * The work() method is a no-op since there's nothing to consume.
 */
export class InlineJobQueue implements JobQueue {
  async start(): Promise<void> {
    // No-op for inline mode
  }

  async stop(): Promise<void> {
    // No-op for inline mode
  }

  async enqueue(
    _name: string,
    _data: RunExecutePayload,
    _options?: EnqueueOptions
  ): Promise<string | null> {
    // In inline mode, enqueue is a no-op — the caller handles execution directly
    return null;
  }

  async work(_name: string, _handler: JobHandler<RunExecutePayload>): Promise<void> {
    // No-op — inline mode doesn't have a consumer loop
  }
}
