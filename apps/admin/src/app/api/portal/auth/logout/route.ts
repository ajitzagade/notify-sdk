import { NextResponse } from 'next/server';
import { PORTAL_SESSION_COOKIE } from '@/lib/tenantPortalAuth';

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PORTAL_SESSION_COOKIE);
  return res;
}
