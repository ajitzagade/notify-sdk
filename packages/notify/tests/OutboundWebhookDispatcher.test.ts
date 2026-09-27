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

  // Verification checklist item: payload nesting consistency. Every event
  // type (sent/delivered/read/failed/reply) is dispatched by
  // apps/*/lib/tenantRegistry.ts via the exact same call —
  // dispatchOutboundWebhooks(tenantId, name, {...event-or-reply}) — with no
  // event-type-specific wrapping at the call site (verified by inspection:
  // apps/api/src/lib/tenantRegistry.ts:113,119 and apps/admin's equivalent).
  // The ONE nesting step is here, in deliverSignedWebhook, applied
  // identically regardless of event type. This test proves that
  // structurally — including a 'reply' payload whose own rawPayload field
  // is itself a nested object (Meta's raw message), confirming that doesn't
  // produce any different or double-wrapped shape than a flat NotifyEvent.
  it('nests every event type identically — {event, data: payload} — with no per-event special-casing', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const cases: Array<{ event: string; payload: Record<string, unknown> }> = [
      { event: 'sent', payload: { id: 'log-1', to: '91987', template: 'text', waMessageId: 'wamid.1', status: 'sent' } },
      { event: 'delivered', payload: { waMessageId: 'wamid.1' } },
      { event: 'failed', payload: { id: 'log-2', to: '91987', template: 'text', status: 'failed', error: 'timeout' } },
      {
        event: 'reply',
        payload: {
          from: '91987', messageId: 'wamid.2', type: 'list', listRowId: 'slot_9am', listRowTitle: '9:00 AM',
          rawPayload: { from: '91987', id: 'wamid.2', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'slot_9am', title: '9:00 AM' } } },
        },
      },
    ];

    for (const { event, payload } of cases) {
      const result = await deliverSignedWebhook({ url: 'https://example.com/hook', secret: 'whsec_test', event, payload });
      expect(result.delivered).toBe(true);

      const call = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
      const body = JSON.parse(call[1].body as string);

      // Same top-level shape every time: exactly {event, data}, data holding
      // the payload verbatim (not re-nested, not flattened).
      expect(Object.keys(body).sort()).toEqual(['data', 'event']);
      expect(body.event).toBe(event);
      expect(body.data).toEqual(payload);
    }
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
