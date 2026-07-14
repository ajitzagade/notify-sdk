import { WhatsAppHttpClient }  from '../http/WhatsAppHttpClient';
import { TemplateEngine }       from '../core/TemplateEngine';
import { GuardEngine }          from '../core/GuardEngine';
import { EventBus }             from '../core/EventBus';
import { extractBodyPreview }   from '../core/extractBodyPreview';
import { InlineQueueAdapter }   from '../adapters/queue/InlineQueueAdapter';
import { InMemoryAdapter }      from '../adapters/storage/InMemoryAdapter';
import { BulkSender, BroadcastList } from '../bulk/BulkSender';
import { WebhookHandler }       from '../webhook/WebhookHandler';
import {
  NotifyConfig,
  SendOptions,
  BulkSendOptions,
  BroadcastResult,
  NotifyEvent,
  IQueueAdapter,
  IStorageAdapter,
  TemplateBuilder,
  QueueJob,
  MetaTemplateSummary,
} from '../types';

export class NotifyClient {
  /** @internal */ readonly config:      NotifyConfig;
  /** @internal */ readonly http:        WhatsAppHttpClient;
  /** @internal */ readonly storage:     IStorageAdapter;
  /** @internal */ readonly eventBus:    EventBus;

  private readonly templates:   TemplateEngine;
  private readonly guard:        GuardEngine;
  private readonly queue:        IQueueAdapter;
  private readonly bulkSender:   BulkSender;
  private readonly webhookHandler: WebhookHandler;

  /** Named broadcast lists — define once, reuse anywhere */
  readonly broadcastLists: BroadcastList;

  constructor(config: NotifyConfig) {
    this.config   = config;
    this.http     = new WhatsAppHttpClient(config.accessToken, config.phoneNumberId, config.wabaId);
    this.storage  = config.storage ?? new InMemoryAdapter();
    this.eventBus = new EventBus();
    this.templates = new TemplateEngine();
    this.guard    = new GuardEngine(config.defaults);
    this.queue    = config.queue ?? new InlineQueueAdapter();
    this.bulkSender    = new BulkSender(this);
    this.broadcastLists = new BroadcastList();
    this.webhookHandler = new WebhookHandler(this);

    // Wire the queue worker
    this.queue.process(async (job: QueueJob) => {
      await this.executeJob(job);
    });

    // Forward EventBus events to config callbacks
    this.eventBus.on('sent',       (e) => config.onSent?.(e as NotifyEvent));
    this.eventBus.on('failed',     (e, err) => config.onFailed?.(e as NotifyEvent, err as Error));
    this.eventBus.on('delivered',  (e) => config.onDelivered?.(e as NotifyEvent));
    this.eventBus.on('read',       (e) => config.onRead?.(e as NotifyEvent));
    this.eventBus.on('reply',      (r) => config.onReply?.(r as import('../types').InboundReply));

    this.log('info', '[Notify] Client initialised');
  }

  // ── Send a single message ──────────────────────────────────────────────────

  async send(options: SendOptions): Promise<NotifyEvent> {
    const pref        = await this.storage.getPreference(options.to);
    const guardResult = this.guard.check(options.to, pref);

    if (!guardResult.allowed) {
      this.log('warn', `[Notify] Blocked send to ${options.to}: ${guardResult.reason}`);
      const blocked: NotifyEvent = {
        id:       crypto.randomUUID(),
        to:       options.to,
        template: options.template,
        status:   'failed',
        tags:     options.tags,
        meta:     { ...options.meta, blockedReason: guardResult.reason },
        error:    guardResult.reason,
      };
      return blocked;
    }

    const payload = this.templates.build(options);
    const logId   = await this.storage.logEvent({
      to:          options.to,
      template:    options.template,
      status:      'queued',
      tags:        options.tags,
      meta:        options.meta,
      bodyPreview: extractBodyPreview(payload),
    });

    const job: QueueJob = { logId, sendOptions: options, payload };

    // High priority — skip queue, send immediately
    if (options.priority === 'high') {
      return this.executeJob(job);
    }

    // Scheduled send
    if (options.scheduleAt) {
      const delay = options.scheduleAt.getTime() - Date.now();
      await this.queue.enqueue(job, { delay: Math.max(delay, 0) });
    } else {
      await this.queue.enqueue(job);
    }

    // Some queue adapters (e.g. InlineQueueAdapter with no delay) fully
    // execute the job synchronously inside enqueue() before it resolves —
    // by this point storage may already reflect the real 'sent'/'failed'
    // outcome, not 'queued'. Read it back rather than assuming the status
    // logged just above is still current. For genuinely async adapters
    // (BullQueueAdapter, or a delayed/scheduled send) the row is still
    // 'queued' at this point, so this correctly falls through unchanged.
    const current = await this.storage.getEvent(logId);
    return current ?? {
      id:          logId,
      to:          options.to,
      template:    options.template,
      status:      'queued',
      tags:        options.tags,
      meta:        options.meta,
      bodyPreview: extractBodyPreview(payload),
    };
  }

  // ── Bulk send ──────────────────────────────────────────────────────────────

  async sendBulk(options: BulkSendOptions): Promise<BroadcastResult> {
    return this.bulkSender.send(options);
  }

  async sendToList(
    listName: string,
    options: Omit<BulkSendOptions, 'recipients'>
  ): Promise<BroadcastResult> {
    const phones = this.broadcastLists.getPhones(listName);
    return this.bulkSender.send({ ...options, recipients: phones });
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  registerTemplate(name: string, builder: TemplateBuilder): this {
    this.templates.register(name, builder);
    return this;
  }

  // ── Opt-in / opt-out / mute ────────────────────────────────────────────────

  async optIn(phone: string): Promise<void> {
    await this.storage.setPreference(phone, { optedIn: true, phone });
    // Confirmation send is best-effort: it's a session message, so Meta
    // rejects it for any number outside the 24h customer-service window
    // (error 131047) — and a failure here must not undo the consent change
    // above or, on the STOP/START webhook path, make the webhook respond
    // non-2xx and trigger Meta's retry loop.
    try {
      await this.http.post('/messages', {
        messaging_product: 'whatsapp',
        to:                phone,
        type:              'text',
        text: {
          body:
            'You are now subscribed to notifications from us.\n\n' +
            'Reply "STOP" at any time to unsubscribe.',
        },
      });
      this.log('info', `[Notify] Opt-in confirmed for ${phone}`);
    } catch (err) {
      const logger = this.config.logger ?? console;
      logger.warn(`[Notify] Opt-in saved for ${phone} but confirmation send failed (non-fatal)`, err);
    }
  }

  async optOut(phone: string): Promise<void> {
    await this.storage.setPreference(phone, { optedIn: false, phone });
    try {
      await this.http.post('/messages', {
        messaging_product: 'whatsapp',
        to:                phone,
        type:              'text',
        text: { body: 'You have been unsubscribed. Reply "START" to re-subscribe.' },
      });
      this.log('info', `[Notify] Opt-out confirmed for ${phone}`);
    } catch (err) {
      const logger = this.config.logger ?? console;
      logger.warn(`[Notify] Opt-out saved for ${phone} but confirmation send failed (non-fatal)`, err);
    }
  }

  async mute(phone: string, durationMs: number): Promise<void> {
    await this.storage.setPreference(phone, {
      phone,
      mutedUntil: new Date(Date.now() + durationMs),
    });
  }

  async unmute(phone: string): Promise<void> {
    await this.storage.setPreference(phone, { phone, mutedUntil: undefined });
  }

  /**
   * Sets opt-in status directly, without sending a WhatsApp confirmation
   * message. For bulk-importing contacts who already consented elsewhere
   * (e.g. a signup form) — use optIn()/optOut() instead when you want
   * WhatsApp to notify the user of the change.
   */
  async setOptInStatus(phone: string, optedIn: boolean): Promise<void> {
    await this.storage.setPreference(phone, { optedIn, phone });
  }

  // ── Webhook mounting ───────────────────────────────────────────────────────

  webhookExpress(app: unknown): void {
    this.webhookHandler.mountExpress(app);
  }

  webhookFastify(app: unknown): void {
    this.webhookHandler.mountFastify(app);
  }

  /** For Next.js — call from your app/api/webhook/whatsapp/route.ts */
  async handleWebhookRequest(rawBody: string, signature: string, body: unknown): Promise<void> {
    return this.webhookHandler.handleNextRequest(rawBody, signature, body);
  }

  /** For TenantWebhookRouter — the signature was already verified against this tenant's appSecret. */
  async processVerifiedWebhookPayload(body: unknown): Promise<void> {
    return this.webhookHandler.processVerifiedPayload(body);
  }

  /** For TenantWebhookRouter — verifies against this tenant's own appSecret. */
  verifyWebhookSignature(signature: string, rawBody: Buffer): boolean {
    return this.webhookHandler.verifySignature(signature, rawBody);
  }

  // ── Convenience: get recent notification log ───────────────────────────────

  async getRecentEvents(limit = 50): Promise<NotifyEvent[]> {
    return this.storage.getRecentEvents(limit);
  }

  // ── Real (HSM) WhatsApp templates ───────────────────────────────────────────

  /** Fetches this account's Meta-approved templates. Requires config.wabaId. */
  async syncTemplates(): Promise<MetaTemplateSummary[]> {
    return this.http.listApprovedTemplates();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async executeJob(job: QueueJob): Promise<NotifyEvent> {
    const { logId, sendOptions, payload } = job;

    try {
      const result      = await this.http.post('/messages', payload);
      const messages    = result.messages as Array<{ id: string }>;
      const waMessageId = messages[0]?.id ?? '';

      await this.storage.updateEvent(logId, {
        status:      'sent',
        waMessageId,
        sentAt:      new Date(),
      });

      const event: NotifyEvent = {
        id:          logId,
        to:          sendOptions.to,
        template:    sendOptions.template,
        status:      'sent',
        waMessageId,
        sentAt:      new Date(),
        tags:        sendOptions.tags,
        meta:        sendOptions.meta,
      };

      this.eventBus.emit('sent', event);
      this.log('info', `[Notify] Sent ${sendOptions.template} → ${sendOptions.to} (${waMessageId})`);
      return event;

    } catch (err: unknown) {
      const error   = err instanceof Error ? err : new Error(String(err));
      const errMsg  = error.message;

      await this.storage.updateEvent(logId, { status: 'failed', error: errMsg });

      const failedEvent: NotifyEvent = {
        id:       logId,
        to:       sendOptions.to,
        template: sendOptions.template,
        status:   'failed',
        error:    errMsg,
      };

      this.eventBus.emit('failed', failedEvent, error);
      this.log('error', `[Notify] Failed ${sendOptions.template} → ${sendOptions.to}: ${errMsg}`);
      throw error;
    }
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, meta?: unknown): void {
    const logger = this.config.logger ?? console;
    logger[level](msg, meta);
  }
}
