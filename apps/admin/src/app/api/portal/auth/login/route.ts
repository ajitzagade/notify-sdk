import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@orgname/notify';
import { getSessionSecret } from '@/lib/security';
import { PORTAL_SESSION_COOKIE, createPortalSessionToken } from '@/lib/tenantPortalAuth';
import { findPortalUserByEmailForLogin, touchPortalUserLastLogin } from '@/lib/tenantPortalUsers';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';

/** Mirrors apps/admin/src/app/api/auth/login/route.ts, but against tenant_portal_users and the portal session cookie. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const rateLimitKey = `portal:${email.toLowerCase()}`;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const user = await findPortalUserByEmailForLogin(email);
  const valid = user?.isActive && (await verifyPassword(password, user.passwordHash, user.passwordSalt));

  if (!valid || !user) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  clearAttempts(rateLimitKey);
  await touchPortalUserLastLogin(user.id);

  const token = createPortalSessionToken(
    { tenantUserId: user.id, tenantId: user.tenantId, email: user.email },
    getSessionSecret()
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60,
  });
  return res;
}
