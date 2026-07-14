import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getConversation, getConversationThread, markConversationRead } from '@/lib/conversations';

export const GET = withPortalSession(
  async (session, _req: NextRequest, ctx: { params: { conversationId: string } }) => {
    const conversation = await getConversation(session.tenantId, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const messages = await getConversationThread(session.tenantId, conversation.contactPhone);

    if (conversation.hasUnread) {
      await markConversationRead(session.tenantId, conversation.id).catch((err) =>
        console.error(`[portal inbox] failed to mark conversation ${conversation.id} read:`, err)
      );
    }

    return NextResponse.json({ conversation: { ...conversation, hasUnread: false }, messages });
  }
);
