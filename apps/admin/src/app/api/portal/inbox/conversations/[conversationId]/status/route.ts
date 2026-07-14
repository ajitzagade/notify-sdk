import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getConversation, setConversationStatus, type ConversationStatus } from '@/lib/conversations';

export const POST = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { conversationId: string } }) => {
    const conversation = await getConversation(session.tenantId, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { status?: ConversationStatus };
    if (body.status !== 'open' && body.status !== 'closed') {
      return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
    }

    await setConversationStatus(session.tenantId, conversation.id, body.status);
    return NextResponse.json({ ok: true });
  }
);
