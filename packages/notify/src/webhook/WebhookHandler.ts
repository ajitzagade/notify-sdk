import { InboundReply } from '../types';
import { verifyWhatsAppSignature } from './signature';

/**
 * WebhookHandler — mounts GET (verification) + POST (events) on your framework.
 * Supports Express, Fastify, Koa, and raw Next.js route handlers.
 */
export class WebhookHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private client: any) {}

  // ── Framework mounts ─────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountExpress(app: any): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');

    app.get('/webhook/whatsapp', (req: { query: Record<string, string> }, res: { send: (s: string) => void; sendStatus: (n: number) => void }) => {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
      if (mode === 'subscribe' && token === this.client.config.verifyToken) {
        res.send(challenge);
      } else {
        res.sendStatus(403);
      }
    });

    app.post(
      '/webhook/whatsapp',
      express.json({
        verify: (req: { rawBody?: Buffer }, _: unknown, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
      async (req: { headers: Record<string, string>; rawBody?: Buffer; body: unknown }, res: { sendStatus: (n: number) => void }) => {
        res.sendStatus(200);
        if (!this.validateSignature(req.headers['x-hub-signature-256'] ?? '', req.rawBody ?? Buffer.from(''))) return;
        await this.processPayload(req.body);
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountFastify(app: any): void {
    app.get('/webhook/whatsapp', (req: { query: Record<string, string> }, reply: { send: (s: string) => void; code: (n: number) => { send: () => void } }) => {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
      if (mode === 'subscribe' && token === this.client.config.verifyToken) {
        reply.send(challenge);
      } else {
        reply.code(403).send();
      }
    });

    app.post('/webhook/whatsapp', async (req: { headers: Record<string, string>; body: unknown }, reply: { code: (n: number) => { send: () => void } }) => {
      reply.code(200).send();
      await this.processPayload(req.body);
    });
  }

  /** For Next.js App Router — call from your route.ts POST handler */
  async handleNextRequest(
    rawBody: string,
    signature: string,
    body: unknown
  ): Promise<void> {
    if (!this.validateSignature(signature, Buffer.from(rawBody))) return;
    await this.processPayload(body);
  }

  /** Generic — pass raw body + signature + parsed body */
  async processRawPayload(
    body: unknown,
    rawBody: string | Buffer,
    signature: string
  ): Promise<void> {
    if (!this.validateSignature(signature, typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)) return;
    await this.processPayload(body);
  }

  // ── Core processing ───────────────────────────────────────────────

  /**
   * For callers that already verified the signature themselves against a
   * different set of credentials than this instance's client — e.g.
   * TenantWebhookRouter, which resolves the tenant (and its appSecret) from
   * the payload first, then delegates here purely for parsing/dispatch.
   */
  async processVerifiedPayload(body: unknown): Promise<void> {
    return this.processPayload(body);
  }

  /** Exposed for TenantWebhookRouter, which verifies against a dynamically-resolved tenant's appSecret. */
  verifySignature(signature: string, rawBody: Buffer): boolean {
    return this.validateSignature(signature, rawBody);
  }

  private async processPayload(body: unknown): Promise<void> {
    const payload = body as Record<string, unknown>;
    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of (payload.entry as unknown[]) ?? []) {
      const e = entry as Record<string, unknown>;
      for (const change of (e.changes as unknown[]) ?? []) {
        const value = (change as Record<string, unknown>).value as Record<string, unknown>;

        // ── Delivery / read status updates ────────────────────────
        for (const status of (value.statuses as unknown[]) ?? []) {
          await this.handleStatusUpdate(status as Record<string, unknown>);
        }

        // ── Inbound messages / button replies ─────────────────────
        for (const message of (value.messages as unknown[]) ?? []) {
          await this.handleInboundMessage(message as Record<string, unknown>);
        }
      }
    }
  }

  private async handleStatusUpdate(status: Record<string, unknown>): Promise<void> {
    const waMessageId = status.id as string;
    const s           = status.status as string;
    const ts          = new Date(Number(status.timestamp) * 1000);

    await this.client.storage.updateByWaMessageId(waMessageId, {
      status: s,
      ...(s === 'delivered' ? { deliveredAt: ts } : {}),
      ...(s === 'read'      ? { readAt:      ts } : {}),
    });

    if (s === 'delivered') this.client.eventBus.emit('delivered', { waMessageId });
    if (s === 'read')      this.client.eventBus.emit('read',      { waMessageId });
  }

  private async handleInboundMessage(message: Record<string, unknown>): Promise<void> {
    // Mark as read (blue ticks)
    await this.client.http.post('/messages', {
      messaging_product: 'whatsapp',
      status:            'read',
      message_id:        message.id,
    });

    const reply = this.parseReply(message);
    this.client.config.onReply?.(reply);
    this.client.eventBus.emit('reply', reply);

    // Auto handle STOP / START commands
    if (reply.type === 'text') {
      const cmd = reply.text?.toLowerCase().trim();
      if (cmd === 'stop' || cmd === 'unsubscribe') {
        await this.client.optOut(reply.from);
      } else if (cmd === 'start' || cmd === 'subscribe') {
        await this.client.optIn(reply.from);
      }
    }
  }

  private parseReply(message: Record<string, unknown>): InboundReply {
    const base = {
      from:        message.from as string,
      messageId:   message.id  as string,
      rawPayload:  message,
    };

    const interactive = message.interactive as Record<string, unknown> | undefined;
    if (message.type === 'interactive' && interactive?.type === 'button_reply') {
      const br = interactive.button_reply as Record<string, string>;
      return { ...base, type: 'button', buttonId: br.id, buttonTitle: br.title };
    }

    const text = message.text as Record<string, string> | undefined;
    return { ...base, type: 'text', text: text?.body };
  }

  private validateSignature(signature: string, rawBody: Buffer): boolean {
    const secret = this.client.config.appSecret as string | undefined;
    const valid  = verifyWhatsAppSignature(secret, rawBody, signature);

    if (!valid && !secret) {
      const logger = this.client.config.logger ?? console;
      logger.warn(
        '[Notify] Webhook rejected: appSecret is not configured. ' +
        'Set NotifyConfig.appSecret to receive inbound WhatsApp events.'
      );
    }

    return valid;
  }
}
