import { IQueueAdapter, QueueJob } from '../../types';

/**
 * BullQueueAdapter — Redis-backed queue for production use.
 * Provides rate limiting (75 msg/sec), retries with exponential backoff,
 * and scheduled delivery.
 *
 * Requires: npm install bull
 */
export class BullQueueAdapter implements IQueueAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: any;

  constructor(redisUrl: string, queueName = 'notify-whatsapp') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Bull = require('bull');
      this.queue = new Bull(queueName, redisUrl, {
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail:     200,
        },
        limiter: {
          max:      75,    // max 75 jobs
          duration: 1000,  // per 1000ms = 75 msg/sec (Meta limit is 80)
        },
      });

      this.queue.on('failed', (job: { id: string; attemptsMade: number }, err: Error) => {
        console.error(
          `[BullQueue] Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`
        );
      });
    } catch {
      throw new Error(
        '[BullQueueAdapter] bull package is required. Run: npm install bull'
      );
    }
  }

  async enqueue(job: QueueJob, opts?: { delay?: number }): Promise<void> {
    await this.queue.add(job, opts?.delay ? { delay: opts.delay } : {});
  }

  process(handler: (job: QueueJob) => Promise<void>): void {
    this.queue.process(75, async (bullJob: { data: QueueJob }) => {
      await handler(bullJob.data);
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
