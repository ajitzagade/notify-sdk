import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getConversation, assignConversationToPortalUser } from '@/lib/conversations';

export const POST = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { conversationId: string } }) => {
    const conversation = await getConversation(session.tenantId, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { userId?: string | null };
    await assignConversationToPortalUser(session.tenantId, conversation.id, body.userId ?? null);

    return NextResponse.json({ ok: true });
  }
);
