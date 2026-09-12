import {
  verifyWhatsAppCredentials,
  createWhatsAppTemplate,
  fetchPhoneNumberHealth,
  exchangeEmbeddedSignupCode,
  subscribeAppToWaba,
} from '@/lib/metaGraph';

// All Graph API calls go through global fetch — mock it per test.
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

beforeEach(() => mockFetch.mockReset());

describe('verifyWhatsAppCredentials', () => {
  it('returns display fields on success', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ verified_name: 'Sunrise Dental', display_phone_number: '+91 98x' })
    );
    const r = await verifyWhatsAppCredentials('tok', '123');
    expect(r).toEqual({ ok: true, displayName: 'Sunrise Dental', displayPhoneNumber: '+91 98x' });
    expect(mockFetch.mock.calls[0][0]).toContain('/123?fields=verified_name');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('surfaces Meta error messages', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: { message: 'Invalid OAuth token' } }, false, 401));
    const r = await verifyWhatsAppCredentials('bad', '123');
    expect(r).toEqual({ ok: false, error: 'Invalid OAuth token' });
  });

  it('never throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));
    const r = await verifyWhatsAppCredentials('tok', '123');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ECONNRESET');
  });
});

describe('createWhatsAppTemplate', () => {
  const def = { name: 'x', language: 'en', category: 'UTILITY' as const, components: [] };

  it('POSTs to /{wabaId}/message_templates and returns id + status', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 't1', status: 'PENDING', category: 'UTILITY' }));
    const r = await createWhatsAppTemplate('tok', 'waba9', def);
    expect(r).toEqual({ ok: true, id: 't1', status: 'PENDING', category: 'UTILITY' });
    expect(mockFetch.mock.calls[0][0]).toContain('/waba9/message_templates');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('prefers Meta\'s human-readable error_user_msg over the raw message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(
        { error: { message: '(#100) Invalid parameter', error_user_msg: 'Template name already exists' } },
        false,
        400
      )
    );
    const r = await createWhatsAppTemplate('tok', 'waba9', def);
    expect(r).toEqual({ ok: false, error: 'Template name already exists' });
  });
});

describe('fetchPhoneNumberHealth', () => {
  it('maps quality_rating and messaging_limit_tier', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ quality_rating: 'GREEN', messaging_limit_tier: 'TIER_250' }));
    const r = await fetchPhoneNumberHealth('tok', '123');
    expect(r).toEqual({ ok: true, qualityRating: 'GREEN', messagingLimitTier: 'TIER_250' });
  });

  it('nulls missing fields rather than failing', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}));
    const r = await fetchPhoneNumberHealth('tok', '123');
    expect(r).toEqual({ ok: true, qualityRating: null, messagingLimitTier: null });
  });
});

describe('exchangeEmbeddedSignupCode', () => {
  it('passes app credentials and code as query params', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ access_token: 'biz-token' }));
    const r = await exchangeEmbeddedSignupCode('app1', 'secret', 'code123');
    expect(r).toEqual({ ok: true, accessToken: 'biz-token' });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('client_id=app1');
    expect(url).toContain('client_secret=secret');
    expect(url).toContain('code=code123');
  });

  it('fails when Meta returns 200 without a token', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}));
    const r = await exchangeEmbeddedSignupCode('app1', 'secret', 'expired');
    expect(r.ok).toBe(false);
  });
});

describe('subscribeAppToWaba', () => {
  it('POSTs to /{wabaId}/subscribed_apps', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    const r = await subscribeAppToWaba('tok', 'waba9');
    expect(r).toEqual({ ok: true });
    expect(mockFetch.mock.calls[0][0]).toContain('/waba9/subscribed_apps');
  });
});
