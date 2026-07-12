import { NotifyClient } from '../client/NotifyClient';
import { PostgresAdapter } from '../adapters/storage/PostgresAdapter';
import { InlineQueueAdapter } from '../adapters/queue/InlineQueueAdapter';
import { IQueueAdapter, NotifyConfig, NotifyLogger } from '../types';

export interface TenantWaCredentials {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret?: string;
  wabaId?: string;
}

export interface TenantCredentialsProvider {
  getCredentials(tenantId: string): Promise<TenantWaCredentials>;
}

export interface TenantClientRegistryOptions {
  credentialsProvider: TenantCredentialsProvider;
  /** Shared pg.Pool (or compatible), passed straight through to PostgresAdapter */
  pool: unknown;
  /** Defaults to a per-tenant InlineQueueAdapter */
  queueFactory?: (tenantId: string) => IQueueAdapter;
  defaults?: NotifyConfig['defaults'];
  /** LRU-ish cap on concurrently cached clients. Default: 100 */
  maxCachedClients?: number;
  /** How long a cached client is trusted before re-resolving credentials. Default: 5 min */
  ttlMs?: number;
  logger?: NotifyLogger;
}

interface CacheEntry {
  client: NotifyClient;
  expiresAt: number;
}

/**
 * Resolves a tenant-scoped NotifyClient on demand and caches it, so one Node
 * process can serve N tenants' WhatsApp credentials without a process-level
 * NotifyClient singleton. Each cached client has its own tenant-scoped
 * PostgresAdapter and its own WhatsAppHttpClient (tenant's access token baked
 * in at construction) — full isolation, no per-call tenantId threading needed
 * anywhere else in the SDK.
 */
export class TenantClientRegistry {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<NotifyClient>>();

  constructor(private options: TenantClientRegistryOptions) {}

  async getClient(tenantId: string): Promise<NotifyClient> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.client;

    const pending = this.inFlight.get(tenantId);
    if (pending) return pending;

    const buildPromise = this.buildClient(tenantId).finally(() => {
      this.inFlight.delete(tenantId);
    });
    this.inFlight.set(tenantId, buildPromise);
    return buildPromise;
  }

  /** Call right after a tenant's credentials are rotated so stale tokens aren't reused. */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async buildClient(tenantId: string): Promise<NotifyClient> {
    const creds   = await this.options.credentialsProvider.getCredentials(tenantId);
    const storage = new PostgresAdapter(this.options.pool, tenantId);
    const queue   = this.options.queueFactory?.(tenantId) ?? new InlineQueueAdapter();

    const client = new NotifyClient({
      accessToken:   creds.accessToken,
      phoneNumberId: creds.phoneNumberId,
      wabaId:        creds.wabaId,
      verifyToken:   creds.verifyToken,
      appSecret:     creds.appSecret,
      storage,
      queue,
      defaults: this.options.defaults,
      logger:   this.options.logger,
    });

    const ttlMs = this.options.ttlMs ?? 5 * 60 * 1000;
    this.cache.set(tenantId, { client, expiresAt: Date.now() + ttlMs });
    this.evictIfOverCapacity();
    return client;
  }

  private evictIfOverCapacity(): void {
    const max = this.options.maxCachedClients ?? 100;
    while (this.cache.size > max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }
}
