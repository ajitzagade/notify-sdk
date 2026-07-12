import { BulkSendOptions, BulkProgress, BroadcastResult, NotifyEvent } from '../types';

export class BulkSender {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private client: any) {}

  async send(options: BulkSendOptions): Promise<BroadcastResult> {
    const broadcastId = crypto.randomUUID();
    const start       = Date.now();

    const {
      recipients,
      batchSize             = 50,
      delayBetweenBatchesMs = 1000,
      onProgress,
      onRecipientSent,
      onRecipientFailed,
      ...sendOptions
    } = options;

    // Deduplicate
    const unique = [...new Set(recipients.filter(Boolean))];
    const chunks = this.chunk(unique, batchSize);

    let sent = 0, failed = 0, skipped = 0;

    for (const [chunkIdx, chunk] of chunks.entries()) {
      const settled = await Promise.allSettled(
        chunk.map(async (phone: string) => {
          const event: NotifyEvent = await this.client.send({
            ...sendOptions,
            to:   phone,
            meta: { ...sendOptions.meta, broadcastId },
          });

          if (event.status === 'failed' && (event.meta as Record<string,unknown>)?.blockedReason) {
            skipped++;
          } else {
            sent++;
            onRecipientSent?.(phone, event);
          }
          return event;
        })
      );

      for (const result of settled) {
        if (result.status === 'rejected') {
          failed++;
          const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          onRecipientFailed?.(chunk[settled.indexOf(result)], err);
        }
      }

      const processed      = Math.min((chunkIdx + 1) * batchSize, unique.length);
      const elapsedMs      = Date.now() - start;
      const msgPerMs       = sent / Math.max(elapsedMs, 1);
      const remaining      = unique.length - processed;
      const estSecsLeft    = Math.ceil(remaining / Math.max(msgPerMs * 1000, 1));

      const progress: BulkProgress = {
        broadcastId,
        total:                unique.length,
        sent,
        failed,
        skipped,
        percent:              Math.round((processed / unique.length) * 100),
        estimatedSecondsLeft: estSecsLeft,
      };

      onProgress?.(progress);

      if (chunkIdx < chunks.length - 1) {
        await this.sleep(delayBetweenBatchesMs);
      }
    }

    return {
      broadcastId,
      total:      unique.length,
      sent,
      failed,
      skipped,
      durationMs: Date.now() - start,
    };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ── Named broadcast lists ────────────────────────────────────────────────────

export interface BroadcastListConfig {
  name: string;
  description?: string;
  phones: string[];
}

export class BroadcastList {
  private lists = new Map<string, BroadcastListConfig>();

  define(config: BroadcastListConfig): this {
    this.lists.set(config.name, { ...config, phones: [...config.phones] });
    return this;
  }

  addMember(listName: string, phone: string): void {
    const list = this.getOrThrow(listName);
    if (!list.phones.includes(phone)) list.phones.push(phone);
  }

  removeMember(listName: string, phone: string): void {
    const list = this.getOrThrow(listName);
    list.phones = list.phones.filter((p) => p !== phone);
  }

  getPhones(listName: string): string[] {
    return [...this.getOrThrow(listName).phones];
  }

  listAll(): BroadcastListConfig[] {
    return Array.from(this.lists.values());
  }

  private getOrThrow(name: string): BroadcastListConfig {
    const list = this.lists.get(name);
    if (!list) throw new Error(`[Notify] Broadcast list "${name}" not found.`);
    return list;
  }
}
