// Pure Meta Graph API wrappers, no local/app-specific dependencies — copied
// from apps/admin/src/lib/metaGraph.ts (which is left untouched; nothing
// there imports from here). Kept here so apps/api's partner provisioning
// routes have a real implementation to call rather than a hand-copied
// duplicate that could drift from admin's, for the two functions that
// matter to provisioning: credential verification and Embedded Signup's
// token exchange + WABA subscription.

const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

export interface MetaVerifyResult {
  ok: boolean;
  displayName?: string;
  displayPhoneNumber?: string;
  error?: string;
}

/** Confirms an access token + phone number ID pair is actually valid against Meta. */
export async function verifyWhatsAppCredentials(
  accessToken: string,
  phoneNumberId: string
): Promise<MetaVerifyResult> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      displayName:         data.verified_name as string | undefined,
      displayPhoneNumber:  data.display_phone_number as string | undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface MetaTokenExchangeResult {
  ok: boolean;
  accessToken?: string;
  /** Seconds until this token expires, if Meta returned one. */
  expiresInSeconds?: number;
  error?: string;
}

/**
 * Exchanges the OAuth code returned by Embedded Signup's FB.login popup for
 * a business token scoped to the client's newly-created WABA. The code is
 * single-use and expires in ~30s — call this immediately on receipt.
 */
export async function exchangeEmbeddedSignupCode(
  appId: string,
  appSecret: string,
  code: string
): Promise<MetaTokenExchangeResult> {
  try {
    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return {
      ok: true,
      accessToken: data.access_token as string,
      expiresInSeconds: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Subscribes our app to the client WABA's webhooks — without this, inbound
 * messages and status updates for an Embedded-Signup tenant never reach
 * apps/api's webhook endpoint.
 */
export async function subscribeAppToWaba(
  accessToken: string,
  wabaId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Registers the phone number for Cloud API messaging (sets its two-step PIN).
 * Fails benignly if the number is already registered — treat non-ok as
 * best-effort unless the subsequent verify also fails.
 */
export async function registerPhoneNumber(
  accessToken: string,
  phoneNumberId: string,
  pin: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
