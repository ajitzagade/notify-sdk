import { deliverSignedWebhook } from '../src/webhook/OutboundWebhookDispatcher';

describe('deliverSignedWebhook', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('blocks a private-IP URL before ever calling fetch', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverSignedWebhook({
      url: 'http://127.0.0.1:9999/hook',
      secret: 'whsec_test',
      event: 'message.sent',
      payload: { id: '1' },
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toMatch(/SSRF guard/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports success for a 2xx response and signs the request', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverSignedWebhook({
      url: 'https://example.com/hook',
      secret: 'whsec_test',
      event: 'message.delivered',
      payload: { waMessageId: 'wamid.1' },
    });

    expect(result).toEqual({ delivered: true, status: 200 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.redirect).toBe('manual');
    expect(init.headers['X-Notify-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
    expect(init.headers['X-Notify-Event']).toBe('message.delivered');
  });

  it('reports failure for a non-2xx response without throwing', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverSignedWebhook({
      url: 'https://example.com/hook',
      secret: 'whsec_test',
      event: 'message.failed',
      payload: {},
    });

    expect(result.delivered).toBe(false);
    expect(result.status).toBe(500);
  });

  it('treats a 3xx response as rejected, not followed', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: false, status: 302 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverSignedWebhook({
      url: 'https://example.com/hook',
      secret: 'whsec_test',
      event: 'reply',
      payload: {},
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toMatch(/Redirect/);
  });
});
