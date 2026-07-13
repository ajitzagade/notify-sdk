import { isDeliverableUrl } from '../security/SsrfGuard';
import { signOutboundWebhookPayload } from './signature';

export interface OutboundWebhookDeliveryResult {
  delivered: boolean;
  status?: number;
  error?: string;
}

/**
 * Signs and delivers one outbound event-webhook payload to a tenant-supplied
 * URL. Pure and DB-free by design — SSRF-checks the URL, signs the body,
 * and fetches with `redirect: 'manual'` so a URL that passed the SSRF check
 * can't 3xx-bounce to an internal address afterward. Tracking which
 * endpoints exist, decrypting their stored secret, and counting/auto-
 * disabling on repeated failure are all tenant/DB-specific and live in each
 * calling app's own lib (mirrors how Phase 1's AI dispatch split pure
 * generation from tenant-aware orchestration).
 *
 * Never throws — every failure mode (blocked by the SSRF guard, network
 * error, non-2xx response) comes back as `{ delivered: false, error }` so
 * callers can update their own failure counters without a try/catch of
 * their own.
 */
export async function deliverSignedWebhook(args: {
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<OutboundWebhookDeliveryResult> {
  const { url, secret, event, payload } = args;

  const deliverable = await isDeliverableUrl(url);
  if (!deliverable) {
    return { delivered: false, error: 'URL did not resolve to a publicly-routable address (blocked by SSRF guard)' };
  }

  const body = JSON.stringify({ event, data: payload });
  const signatureHeader = signOutboundWebhookPayload(secret, body);

  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual', // a URL that resolved public just now can't be allowed to bounce to an internal one
      headers: {
        'Content-Type': 'application/json',
        'X-Notify-Signature': signatureHeader,
        'X-Notify-Event': event,
      },
      body,
    });

    if (res.status >= 300 && res.status < 400) {
      return { delivered: false, status: res.status, error: 'Redirect response rejected (redirect: manual)' };
    }
    if (!res.ok) {
      return { delivered: false, status: res.status, error: `Endpoint responded with ${res.status}` };
    }
    return { delivered: true, status: res.status };
  } catch (err) {
    return { delivered: false, error: err instanceof Error ? err.message : String(err) };
  }
}
