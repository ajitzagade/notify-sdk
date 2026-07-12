import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

/**
 * Next 14's middleware runs on the Edge runtime, which doesn't have Node's
 * `crypto` module — so this can only do a cheap cookie-presence check, not
 * real session verification (that needs node:crypto, done via
 * `requireAdminSession()` in src/lib/auth.ts, called by every protected page
 * and route handler, which run in the Node runtime). This middleware is a
 * UX nicety (fast redirect for the common case), not the authorization
 * boundary — every route enforces its own auth regardless.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasCookie = req.cookies.has('notify_admin_session');
  if (!hasCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
