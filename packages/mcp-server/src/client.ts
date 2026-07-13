import type { Config } from './config';

/**
 * Thin wrapper over the tenant's own /v1 REST API — this server is a
 * consumer of that API like any other, authenticated with a Bearer tenant
 * API key. No direct database or SDK access; everything goes through the
 * same routes and rate limiting a tenant's own backend would hit.
 */
export class NotifyApiClient {
  constructor(private config: Config) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...init?.headers,
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`${path} → ${res.status}: ${body?.error ?? res.statusText}`);
    }
    return body as T;
  }

  /** GET /v1/logs — the 50 most recent send events for this tenant. */
  getRecentLogs(): Promise<unknown[]> {
    return this.request('/v1/logs');
  }

  /** POST /v1/send — a single message. */
  sendMessage(payload: {
    to: string;
    template: string;
    text?: string;
    data?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request('/v1/send', { method: 'POST', body: JSON.stringify(payload) });
  }

  /** POST /v1/opt-in */
  optIn(phone: string): Promise<unknown> {
    return this.request('/v1/opt-in', { method: 'POST', body: JSON.stringify({ phone }) });
  }

  /** POST /v1/opt-out */
  optOut(phone: string): Promise<unknown> {
    return this.request('/v1/opt-out', { method: 'POST', body: JSON.stringify({ phone }) });
  }
}
