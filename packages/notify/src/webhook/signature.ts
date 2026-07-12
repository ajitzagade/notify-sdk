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
