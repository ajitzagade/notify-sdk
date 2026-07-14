import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getConversation, sendReplyInThread } from '@/lib/conversations';

export const POST = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { conversationId: string } }) => {
    const conversation = await getConversation(session.tenantId, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { text?: string };
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    try {
      const event = await sendReplyInThread(session.tenantId, conversation.contactPhone, body.text.trim());
      return NextResponse.json({ ok: true, event });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
);
