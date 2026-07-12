import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from '@orgname/notify';
import { getSessionSecret } from './security';

export const SESSION_COOKIE = 'notify_admin_session';

/** Reads + verifies the session cookie. Null if absent/expired/tampered. */
export function getAdminSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifySessionToken(token, getSessionSecret());
  } catch {
    return null; // e.g. SESSION_SECRET missing/misconfigured
  }
}

/**
 * The real authorization boundary for Server Components/pages — middleware
 * only does a cheap cookie-presence redirect (Edge runtime can't run node:crypto
 * session verification), so every protected page calls this too.
 */
export function requireAdminSessionOrRedirect(): SessionPayload {
  const session = getAdminSession();
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
    const session = getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(session, ...args);
  };
}
