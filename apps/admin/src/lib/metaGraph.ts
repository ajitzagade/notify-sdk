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
