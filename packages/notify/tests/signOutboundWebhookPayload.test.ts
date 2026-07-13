import crypto from 'crypto';
import { signOutboundWebhookPayload } from '../src/webhook/signature';

describe('signOutboundWebhookPayload', () => {
  it('produces a t=/v1= header whose digest matches a manual HMAC over timestamp.body', () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ event: 'message.sent', id: 'abc123' });
    const timestamp = 1_700_000_000;

    const header = signOutboundWebhookPayload(secret, body, timestamp);
    expect(header).toBe(
      `t=${timestamp},v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
    );
  });

  it('produces a different signature for a different body', () => {
    const secret = 'whsec_test';
    const timestamp = 1_700_000_000;
    const a = signOutboundWebhookPayload(secret, 'body-a', timestamp);
    const b = signOutboundWebhookPayload(secret, 'body-b', timestamp);
    expect(a).not.toBe(b);
  });

  it('folds the timestamp into the signed material, not just alongside it', () => {
    const secret = 'whsec_test';
    const body = 'same-body';
    const a = signOutboundWebhookPayload(secret, body, 1_700_000_000);
    const b = signOutboundWebhookPayload(secret, body, 1_700_000_001);
    expect(a).not.toBe(b); // same body, different timestamp → different digest, replay with a stale timestamp fails
  });
});
