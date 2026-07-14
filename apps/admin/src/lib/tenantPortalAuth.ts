import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getSessionSecret } from './security';

export const PORTAL_SESSION_COOKIE = 'notify_tenant_session';

/**
 * Session token for tenant portal logins — a fully separate mechanism from
 * apps/admin/src/lib/auth.ts's admin session (different cookie name,
 * different payload shape, own AES-256-GCM implementation here rather than
 * widening packages/notify's SessionCookie.ts, which is shared by apps/api,
 * apps/web, and external SDK consumers).
 *
 * Deliberately does NOT encrypt under the raw SESSION_SECRET — a portal
 * token and an admin token would then be interchangeable ciphertext under
 * the same key, so a portal user replaying their own cookie value under the
 * `notify_admin_session` cookie name would decrypt as a "valid" admin
 * session (packages/notify's verifySessionToken has no discriminator and
 * apps/admin/src/lib/auth.ts never validated adminUserId/role were actually
 * present). Instead, HKDF-derives a key scoped to this token type only —
 * same pattern packages/notify/src/security/CredentialCipher.ts already
 * uses to separate per-tenant keys from one root key — so a portal token is
 * cryptographically incapable of decrypting as an admin session, full stop,
 * regardless of any payload-shape check on either side.
 */

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12;
const TAG_LENGTH = 16;

function derivePortalSessionKey(sessionSecret: Buffer): Buffer {
  const info = Buffer.from('notify-sdk:tenant-portal-session:v1');
  return Buffer.from(crypto.hkdfSync('sha256', sessionSecret, Buffer.alloc(0), info, 32));
}

export interface PortalSessionPayload {
  kind: 'tenant';
  tenantUserId: string;
  tenantId: string;
  email: string;
  iat: number; // issued-at, ms epoch
  exp: number; // expiry, ms epoch
}

export function createPortalSessionToken(
  payload: Pick<PortalSessionPayload, 'tenantUserId' | 'tenantId' | 'email'>,
  sessionSecret: Buffer,
  ttlMs = 7 * 24 * 60 * 60 * 1000
): string {
  const now = Date.now();
  const full: PortalSessionPayload = { kind: 'tenant', ...payload, iat: now, exp: now + ttlMs };
  const key = derivePortalSessionKey(sessionSecret);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(full), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function verifyPortalSessionToken(token: string, sessionSecret: Buffer): PortalSessionPayload | null {
  try {
    const key = derivePortalSessionKey(sessionSecret);
    const raw        = Buffer.from(token, 'base64url');
    const iv          = raw.subarray(0, IV_LENGTH);
    const tag          = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext  = raw.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const payload = JSON.parse(plaintext.toString('utf8')) as PortalSessionPayload;
    if (payload.kind !== 'tenant' || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null; // tampered, malformed, wrong key, or wrong secret
  }
}

/** Reads + verifies the portal session cookie. Null if absent/expired/tampered. */
export function getPortalSession(): PortalSessionPayload | null {
  const token = cookies().get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyPortalSessionToken(token, getSessionSecret());
  } catch {
    return null;
  }
}

/** The real authorization boundary for portal Server Components/pages. */
export function requirePortalSessionOrRedirect(): PortalSessionPayload {
  const session = getPortalSession();
  if (!session) redirect('/portal/login');
  return session;
}

/** Wraps a portal Route Handler so it 401s before running if there's no valid session. */
export function withPortalSession<Args extends unknown[]>(
  handler: (session: PortalSessionPayload, ...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    const session = getPortalSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(session, ...args);
  };
}
