import { IQueueAdapter, QueueJob } from '../../types';

/**
 * InlineQueueAdapter — zero dependencies, fires jobs synchronously.
 * Use for development, testing, or low-volume apps that don't need Redis.
 */
export class InlineQueueAdapter implements IQueueAdapter {
  private handler?: (job: QueueJob) => Promise<void>;

  async enqueue(job: QueueJob, opts?: { delay?: number }): Promise<void> {
    if (!this.handler) {
      throw new Error('[InlineQueueAdapter] No processor registered. Call process() first.');
    }

    if (opts?.delay && opts.delay > 0) {
      setTimeout(() => {
        this.handler!(job).catch((err) =>
          console.error('[InlineQueueAdapter] Job failed:', err)
        );
      }, opts.delay);
    } else {
      await this.handler(job);
    }
  }

  process(handler: (job: QueueJob) => Promise<void>): void {
    this.handler = handler;
  }
}
