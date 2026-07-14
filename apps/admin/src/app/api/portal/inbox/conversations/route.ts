import { NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listConversations } from '@/lib/conversations';

export const GET = withPortalSession(async (session) => {
  const conversations = await listConversations(session.tenantId);
  return NextResponse.json({ conversations });
});
