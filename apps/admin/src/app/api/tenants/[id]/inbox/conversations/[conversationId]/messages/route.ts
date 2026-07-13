import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getConversation, getConversationThread, markConversationRead } from '@/lib/conversations';

export const GET = withAdminSession(
  async (_session, _req: NextRequest, ctx: { params: { id: string; conversationId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const conversation = await getConversation(tenant.id, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const messages = await getConversationThread(tenant.id, conversation.contactPhone);

    // Opening a thread is what "reading" it means for a shared inbox — no
    // separate "mark as read" click needed. Best-effort: a failure here
    // shouldn't stop the thread from displaying.
    if (conversation.hasUnread) {
      await markConversationRead(tenant.id, conversation.id).catch((err) =>
        console.error(`[inbox] failed to mark conversation ${conversation.id} read:`, err)
      );
    }

    return NextResponse.json({ conversation: { ...conversation, hasUnread: false }, messages });
  }
);
