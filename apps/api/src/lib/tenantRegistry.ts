import {
  TenantClientRegistry,
  TenantCredentialsProvider,
  TenantWaCredentials,
  NotifyClient,
  NotifyEvent,
  InboundReply,
  decryptSecret,
  resolveKeyForVersion,
} from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';
import { dispatchAiAutoReply } from './aiAutoReply';
import { dispatchOutboundWebhooks } from './webhookDispatch';
import { upsertConversationOnReply } from './conversations';

class PgTenantCredentialsProvider implements TenantCredentialsProvider {
  async getCredentials(tenantId: string): Promise<TenantWaCredentials> {
    const { rows } = await getPool().query(
      `SELECT phone_number_id, waba_id, verify_token, key_version,
              access_token_ciphertext, access_token_iv, access_token_tag,
              app_secret_ciphertext, app_secret_iv, app_secret_tag
         FROM tenant_wa_credentials WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`[api] No WhatsApp credentials configured for tenant ${tenantId}`);
    }

    const keyVersion = row.key_version as number;
    const masterKey  = resolveKeyForVersion(getMasterKeyRing(), keyVersion);

    const accessToken = decryptSecret(
      {
        ciphertext: row.access_token_ciphertext as string,
        iv:         row.access_token_iv as string,
        tag:        row.access_token_tag as string,
      },
      tenantId,
      masterKey,
      keyVersion
    );

    const appSecret = row.app_secret_ciphertext
      ? decryptSecret(
          {
            ciphertext: row.app_secret_ciphertext as string,
            iv:         row.app_secret_iv as string,
            tag:        row.app_secret_tag as string,
          },
          tenantId,
          masterKey,
          keyVersion
        )
      : undefined;

    return {
      accessToken,
      phoneNumberId: row.phone_number_id as string,
      wabaId:        row.waba_id as string | undefined,
      verifyToken:   row.verify_token as string,
      appSecret,
    };
  }
}

/**
 * AI auto-reply (Phase 1), outbound event webhooks (Phase 2), and the shared
 * inbox's conversation tracking (Phase 3) all hook in here — new listeners
 * on events this client already emits, never a change to WebhookHandler.ts
 * or NotifyClient itself. This is the registry that actually matters for all
 * three: real inbound webhooks land on /v1/webhook/whatsapp, processed by
 * clients built here, not in apps/admin.
 */
function onClientReady(client: NotifyClient, tenantId: string): void {
  const onFailFast = (label: string) => (err: unknown) =>
    console.error(`[tenantRegistry] ${label} threw unexpectedly for tenant ${tenantId}:`, err);

  client.eventBus.on('reply', (reply) => {
    const r = reply as InboundReply;
    dispatchAiAutoReply(tenantId, r, client).catch(onFailFast('AI auto-reply dispatch'));
    dispatchOutboundWebhooks(tenantId, 'reply', { ...r }).catch(onFailFast('webhook dispatch'));
    upsertConversationOnReply(tenantId, r.from).catch(onFailFast('conversation upsert'));
  });

  const onMessageEvent = (name: 'sent' | 'delivered' | 'read' | 'failed', event: NotifyEvent, error?: Error) => {
    dispatchOutboundWebhooks(tenantId, name, { ...event, error: error?.message ?? event.error }).catch(
      onFailFast('webhook dispatch')
    );
  };
  client.eventBus.on('sent', (e) => onMessageEvent('sent', e as NotifyEvent));
  client.eventBus.on('delivered', (e) => onMessageEvent('delivered', e as NotifyEvent));
  client.eventBus.on('read', (e) => onMessageEvent('read', e as NotifyEvent));
  client.eventBus.on('failed', (e, err) => onMessageEvent('failed', e as NotifyEvent, err as Error));
}

let registry: TenantClientRegistry | null = null;

export function getTenantRegistry(): TenantClientRegistry {
  if (registry) return registry;
  registry = new TenantClientRegistry({
    credentialsProvider: new PgTenantCredentialsProvider(),
    pool: getPool(),
    onClientReady,
  });
  return registry;
}
