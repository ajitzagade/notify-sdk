import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken } from '@orgname/notify';
import { getPool } from '@/lib/db';
import { getSessionSecret } from '@/lib/security';
import { SESSION_COOKIE } from '@/lib/auth';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const rateLimitKey = email.trim().toLowerCase();
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const { rows } = await getPool().query(
    `SELECT id, email, password_hash, password_salt, role, is_active
       FROM admin_users WHERE email = $1 LIMIT 1`,
    [rateLimitKey]
  );
  const user = rows[0];

  const valid =
    user?.is_active &&
    (await verifyPassword(password, user.password_hash as string, user.password_salt as string));

  if (!valid) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  clearAttempts(rateLimitKey);
  await getPool().query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

  const token = createSessionToken(
    { adminUserId: user.id as string, email: user.email as string, role: user.role as 'super_admin' | 'ops' },
    getSessionSecret()
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60,
  });
  return res;
}
