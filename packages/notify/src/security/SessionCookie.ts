import crypto from 'crypto';

/**
 * Minimal signed + encrypted session cookie (AES-256-GCM), used by apps/admin
 * for internal-admin login sessions. Reuses the same authenticated-encryption
 * primitive as CredentialCipher instead of adding a session library (e.g.
 * iron-session) as a dependency — one crypto module, no extra deps.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface SessionPayload {
  adminUserId: string;
  email: string;
  role: 'super_admin' | 'ops';
  iat: number; // issued-at, ms epoch
  exp: number; // expiry, ms epoch
}

export function parseSessionSecret(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `[SessionCookie] SESSION_SECRET must decode to 32 bytes, got ${key.length}. ` +
      `Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

export function createSessionToken(
  payload: Pick<SessionPayload, 'adminUserId' | 'email' | 'role'>,
  secret: Buffer,
  ttlMs = 7 * 24 * 60 * 60 * 1000
): string {
  const now = Date.now();
  const full: SessionPayload = { ...payload, iat: now, exp: now + ttlMs };

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(full), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function verifySessionToken(token: string, secret: Buffer): SessionPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    const iv         = raw.subarray(0, IV_LENGTH);
    const tag         = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, secret, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const payload = JSON.parse(plaintext.toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null; // tampered, malformed, or wrong secret
  }
}
