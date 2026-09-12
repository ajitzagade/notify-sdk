import { NextRequest, NextResponse } from 'next/server';

// /privacy and /data-deletion must stay public: Meta's App Review crawls them
// (Privacy Policy URL + User Data Deletion URL in App settings → Basic).
// /api/cron/* has its own CRON_SECRET bearer-token check (see that route) —
// it must stay public here too, since Vercel's own cron invocation never
// carries an admin session cookie and would otherwise 401 before reaching it.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/portal/login', '/api/portal/auth/login', '/privacy', '/data-deletion', '/api/cron'];

/**
 * Next 14's middleware runs on the Edge runtime, which doesn't have Node's
 * `crypto` module — so this can only do a cheap cookie-presence check, not
 * real session verification (that needs node:crypto, done via
 * `requireAdminSession()` in src/lib/auth.ts, called by every protected page
 * and route handler, which run in the Node runtime). This middleware is a
 * UX nicety (fast redirect for the common case), not the authorization
 * boundary — every route enforces its own auth regardless.
 *
 * `/portal/*` and `/api/portal/*` are a fully separate tenant-facing login
 * (see src/lib/tenantPortalAuth.ts) — same cheap-cookie-presence pattern,
 * but keyed on its own cookie and its own login redirect, so admin and
 * portal sessions never satisfy each other's gate.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const isPortal    = pathname.startsWith('/portal') || pathname.startsWith('/api/portal');
  const cookieName  = isPortal ? 'notify_tenant_session' : 'notify_admin_session';
  const loginPath   = isPortal ? '/portal/login' : '/login';

  const hasCookie = req.cookies.has(cookieName);
  if (!hasCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // icon.png/apple-icon.png are Next's App Router favicon convention (a real
  // route, not a static file) — without excluding them here the same way
  // favicon.ico already is, the auth check 307s every favicon request to
  // /login, which is why the icon never actually rendered.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)'],
};
