import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { verifyWhatsAppCredentials } from '@/lib/metaGraph';

export const POST = withAdminSession(async (_session, req: NextRequest) => {
  const body = (await req.json()) as { accessToken?: string; phoneNumberId?: string };
  if (!body.accessToken || !body.phoneNumberId) {
    return NextResponse.json({ error: 'accessToken and phoneNumberId are required' }, { status: 400 });
  }

  const result = await verifyWhatsAppCredentials(body.accessToken, body.phoneNumberId);
  return NextResponse.json(result);
});
