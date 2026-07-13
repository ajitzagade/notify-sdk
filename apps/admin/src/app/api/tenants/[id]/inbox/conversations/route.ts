import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listConversations } from '@/lib/conversations';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const conversations = await listConversations(tenant.id);
  return NextResponse.json({ conversations });
});
