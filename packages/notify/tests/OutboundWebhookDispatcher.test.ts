import crypto from 'crypto';
import { deliverSignedWebhook } from '../src/webhook/OutboundWebhookDispatcher';

describe('deliverSignedWebhook', () => {
  // Regression guard for Cliniqly work item 3: reply/status payloads gained
  // new fields (InboundReply.listRowId/listRowTitle, NotifyEvent already had
  // waMessageId). The signing contract is "HMAC over JSON.stringify({event,
  // data: payload})" with no fixed schema, so adding fields to `payload`
  // must not change how the signature is computed or verified — a consumer
  // recomputing the HMAC over the literal received body keeps working
  // whether or not it recognizes the new keys.
  it('signs correctly when the payload carries new fields a consumer may not recognize', async () => {
    const secret = 'whsec_test';
    const richPayload = {
      from: '919876543210',
      messageId: 'wamid.abc123',
      type: 'list',
      listRowId: 'slot_9am',
      listRowTitle: '9:00 AM',
    };

    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverSignedWebhook({
      url: 'https://example.com/hook', secret, event: 'reply', payload: richPayload,
    });
    expect(result.delivered).toBe(true);

    const [, init] = fetchSpy.mock.calls[0];
    const expectedBody = JSON.stringify({ event: 'reply', data: richPayload });
    expect(init.body).toBe(expectedBody);

    const [, sig] = (init.headers['X-Notify-Signature'] as string).split(',');
    const [, digest] = sig.split('=');
    const timestamp = (init.headers['X-Notify-Signature'] as string).match(/^t=(\d+)/)?.[1];
    const expectedDigest = crypto.createHmac('sha256', secret).update(`${timestamp}.${expectedBody}`).digest('hex');
    expect(digest).toBe(expectedDigest);
  });
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
