const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

export interface MetaVerifyResult {
  ok: boolean;
  displayName?: string;
  displayPhoneNumber?: string;
  error?: string;
}

export interface MetaTemplateCreateResult {
  ok: boolean;
  id?: string;
  status?: string;
  category?: string;
  error?: string;
}

/**
 * Submits a new message template to Meta for review.
 * POST /{waba_id}/message_templates — the write counterpart of the SDK's
 * listApprovedTemplates() sync. Meta responds with the template id and an
 * initial status (usually PENDING, sometimes APPROVED immediately).
 */
export async function createWhatsAppTemplate(
  accessToken: string,
  wabaId: string,
  template: { name: string; language: string; category: 'UTILITY' | 'MARKETING'; components: unknown[] }
): Promise<MetaTemplateCreateResult> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(wabaId)}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });
    const data = await res.json();

    if (!res.ok) {
      const message =
        (data?.error?.error_user_msg as string) ??
        (data?.error?.message as string) ??
        `HTTP ${res.status}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      id:       data.id as string | undefined,
      status:   data.status as string | undefined,
      category: data.category as string | undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface MetaTokenExchangeResult {
  ok: boolean;
  accessToken?: string;
  /** Seconds until this token expires, if Meta returned one — the Embedded
   * Signup "System-user access token, 60 days" configuration always should. */
  expiresInSeconds?: number;
  error?: string;
}

/**
 * Exchanges the OAuth code returned by Embedded Signup's FB.login popup for a
 * business token scoped to the client's newly-created WABA. The code is
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
 * Extends a still-valid long-lived token for another ~60 days, via the same
 * `fb_exchange_token` grant Meta uses generally for this — NOT a different
 * "refresh token" mechanism. Meta requires the token be at least 24h old and
 * not yet expired; the refresh cron only ever calls this ~30 days before
 * expiry, well within both bounds. Never requires the client to redo the
 * Embedded Signup flow.
 */
export async function refreshLongLivedAccessToken(
  appId: string,
  appSecret: string,
  currentToken: string
): Promise<MetaTokenExchangeResult> {
  try {
    const params = new URLSearchParams({
      grant_type:        'fb_exchange_token',
      client_id:         appId,
      client_secret:     appSecret,
      fb_exchange_token: currentToken,
    });
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

export interface MetaPhoneHealth {
  ok: boolean;
  qualityRating?: string | null;
  messagingLimitTier?: string | null;
  error?: string;
}

/**
 * Reads the phone number's quality rating and messaging-limit tier — the two
 * Meta-side signals behind the sending-health widget. Short timeout: this is
 * called on analytics requests and must never hang the dashboard.
 */
export async function fetchPhoneNumberHealth(
  accessToken: string,
  phoneNumberId: string
): Promise<MetaPhoneHealth> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}?fields=quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    if (!res.ok) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      qualityRating:      (data.quality_rating as string | undefined) ?? null,
      messagingLimitTier: (data.messaging_limit_tier as string | undefined) ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
