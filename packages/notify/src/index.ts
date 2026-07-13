// Core
export { NotifyClient }          from './client/NotifyClient';

// Adapters — queue
export { InlineQueueAdapter }    from './adapters/queue/InlineQueueAdapter';
export { BullQueueAdapter }      from './adapters/queue/BullQueueAdapter';

// Adapters — storage
export { InMemoryAdapter }       from './adapters/storage/InMemoryAdapter';
export { PostgresAdapter, LEGACY_TENANT_ID } from './adapters/storage/PostgresAdapter';

// Multi-tenant
export { TenantClientRegistry }  from './tenant/TenantClientRegistry';
export type {
  TenantWaCredentials,
  TenantCredentialsProvider,
  TenantClientRegistryOptions,
} from './tenant/TenantClientRegistry';

// Security
export { encryptSecret, decryptSecret, parseMasterKey, resolveKeyForVersion, reEncryptToCurrentVersion } from './security/CredentialCipher';
export type { EncryptedSecret, MasterKeyRing }            from './security/CredentialCipher';
export { hashPassword, verifyPassword }                   from './security/PasswordHash';
export type { HashedPassword }                             from './security/PasswordHash';
export { createSessionToken, verifySessionToken, parseSessionSecret } from './security/SessionCookie';
export type { SessionPayload }                             from './security/SessionCookie';
export { isPrivateOrReservedIp, isDeliverableUrl }         from './security/SsrfGuard';

// Webhook
export { verifyWhatsAppSignature, signOutboundWebhookPayload } from './webhook/signature';
export { deliverSignedWebhook } from './webhook/OutboundWebhookDispatcher';
export type { OutboundWebhookDeliveryResult } from './webhook/OutboundWebhookDispatcher';
export { TenantWebhookRouter }     from './webhook/TenantWebhookRouter';
export type { TenantWebhookRouterOptions, TenantWebhookResult } from './webhook/TenantWebhookRouter';

// Types
export type {
  NotifyConfig,
  SendOptions,
  MediaAttachment,
  HsmParameter,
  HsmComponent,
  MetaTemplateSummary,
  BulkSendOptions,
  BulkProgress,
  BroadcastResult,
  NotifyEvent,
  InboundReply,
  RecipientPreference,
  IQueueAdapter,
  IStorageAdapter,
  TemplateBuilder,
  NotifyLogger,
  QueueJob,
} from './types';
