import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getConversation, setConversationStatus, type ConversationStatus } from '@/lib/conversations';

export const POST = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; conversationId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const conversation = await getConversation(tenant.id, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { status?: ConversationStatus };
    if (body.status !== 'open' && body.status !== 'closed') {
      return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
    }

    await setConversationStatus(tenant.id, conversation.id, body.status);
    return NextResponse.json({ ok: true });
  }
);
