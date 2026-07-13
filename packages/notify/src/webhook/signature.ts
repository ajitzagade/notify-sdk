import crypto from 'crypto';

/**
 * Verifies Meta's `X-Hub-Signature-256` HMAC-SHA256 header against the raw
 * webhook body. Fails CLOSED: a missing secret or missing/invalid signature
 * is rejected, never silently allowed through.
 */
export function verifyWhatsAppSignature(
  secret: string | undefined,
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!secret || !signatureHeader) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const actualBuf   = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;

  try {
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Signs an outbound event-webhook delivery (message.sent/delivered/read/
 * failed/reply) so a tenant's receiving endpoint can verify it really came
 * from us and wasn't replayed. HMAC-SHA256 over `${timestamp}.${body}` —
 * the timestamp is folded into the signed material (not just sent
 * alongside it) so a captured payload can't be re-sent later with a new
 * timestamp and still verify.
 *
 * Returns a single header value in the form `t=<unix-seconds>,v1=<hex-hmac>`,
 * mirroring the widely-used Stripe-style webhook signature shape — a
 * receiver splits on the comma, re-derives the HMAC over `t.body`, and
 * rejects if the timestamp is stale (replay window) or the digest doesn't
 * match. Sibling to verifyWhatsAppSignature above, not a replacement for it —
 * that one verifies Meta's *inbound* signature, this one produces *our own
 * outbound* one.
 */
export function signOutboundWebhookPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signed}`;
}
