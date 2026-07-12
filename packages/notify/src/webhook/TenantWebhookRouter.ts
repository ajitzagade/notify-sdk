import { TenantClientRegistry } from '../tenant/TenantClientRegistry';

export interface TenantWebhookRouterOptions {
  registry: TenantClientRegistry;
  /** Resolves a webhook payload's phone_number_id to a tenant ID, or null if unrecognized. */
  resolveTenantId: (phoneNumberId: string) => Promise<string | null>;
}

export interface TenantWebhookResult {
  status: number;
  reason?: string;
}

/**
 * Routes a single shared Meta webhook callback URL to the correct tenant.
 * Meta sends inbound events keyed by `phone_number_id`, not tenant ID, so this
 * peeks that field out of the payload first, resolves which tenant owns it,
 * then verifies the signature against THAT tenant's appSecret (never a
 * globally-configured one) before dispatching to their WebhookHandler.
 */
export class TenantWebhookRouter {
  constructor(private options: TenantWebhookRouterOptions) {}

  static extractPhoneNumberId(body: unknown): string | null {
    const payload = body as Record<string, unknown>;
    for (const entry of (payload.entry as unknown[]) ?? []) {
      for (const change of ((entry as Record<string, unknown>).changes as unknown[]) ?? []) {
        const value    = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
        const metadata = value?.metadata as Record<string, unknown> | undefined;
        const phoneNumberId = metadata?.phone_number_id as string | undefined;
        if (phoneNumberId) return phoneNumberId;
      }
    }
    return null;
  }

  async handle(rawBody: Buffer, signatureHeader: string, parsedBody: unknown): Promise<TenantWebhookResult> {
    const phoneNumberId = TenantWebhookRouter.extractPhoneNumberId(parsedBody);
    if (!phoneNumberId) {
      // Nothing routable (e.g. an event type without metadata) — 200 so Meta doesn't retry.
      return { status: 200 };
    }

    const tenantId = await this.options.resolveTenantId(phoneNumberId);
    if (!tenantId) {
      return { status: 404, reason: `No tenant found for phone_number_id ${phoneNumberId}` };
    }

    const client = await this.options.registry.getClient(tenantId);
    if (!client.verifyWebhookSignature(signatureHeader, rawBody)) {
      return { status: 401, reason: 'Invalid webhook signature' };
    }

    await client.processVerifiedWebhookPayload(parsedBody);
    return { status: 200 };
  }
}
