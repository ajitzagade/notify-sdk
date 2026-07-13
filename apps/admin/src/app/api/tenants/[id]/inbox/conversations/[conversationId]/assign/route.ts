import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getConversation, assignConversation } from '@/lib/conversations';

export const POST = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; conversationId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const conversation = await getConversation(tenant.id, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { adminId?: string | null };
    await assignConversation(tenant.id, conversation.id, body.adminId ?? null);

    return NextResponse.json({ ok: true });
  }
);
