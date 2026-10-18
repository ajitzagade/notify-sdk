import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from '@orgname/notify';
import { getSessionSecret } from './security';
import { getPool } from './db';

export const SESSION_COOKIE = 'notify_admin_session';

/**
 * Reads + verifies the session cookie. Null if absent/expired/tampered — or,
 * defense-in-depth, if the decrypted payload isn't actually admin-shaped.
 * verifySessionToken (packages/notify) only checks `exp`; it has no way to
 * know this cookie's payload should carry a real adminUserId/role, so that
 * check belongs here, at the one call site that treats the result as
 * "this request is an internal admin."
 */
export function getAdminSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const session = verifySessionToken(token, getSessionSecret());
    if (!session?.adminUserId || (session.role !== 'super_admin' && session.role !== 'ops')) {
      return null;
    }
    return session;
  } catch {
    return null; // e.g. SESSION_SECRET missing/misconfigured
  }
}

/**
 * Cryptographic check + per-request DB revalidation, mirroring the portal's
 * (tenantPortalAuth.ts). Admin tokens are stateless with a 7-day TTL, so
 * without the DB check a deactivated admin — the highest-privilege account
 * type, able to mint API keys and change any tenant's credentials — would
 * keep full access until token expiry. One PK lookup per request.
 */
async function getValidatedAdminSession(): Promise<SessionPayload | null> {
  const session = getAdminSession();
  if (!session) return null;
  try {
    const { rows } = await getPool().query(
      `SELECT is_active, password_changed_at FROM admin_users WHERE id = $1`,
      [session.adminUserId]
    );
    const row = rows[0];
    if (!row || !row.is_active) return null;
    if (session.iat < new Date(row.password_changed_at as string).getTime()) return null;
    return session;
  } catch {
    return null; // DB unreachable → fail closed
  }
}

/**
 * The real authorization boundary for Server Components/pages — middleware
 * only does a cheap cookie-presence redirect (Edge runtime can't run node:crypto
 * session verification), so every protected page calls this too.
 */
export async function requireAdminSessionOrRedirect(): Promise<SessionPayload> {
  const session = await getValidatedAdminSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Wraps a Route Handler so it 401s before running if there's no valid
 * session — the real authorization boundary for API routes.
 */
export function withAdminSession<Args extends unknown[]>(
  handler: (session: SessionPayload, ...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    const session = await getValidatedAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(session, ...args);
  };
}
