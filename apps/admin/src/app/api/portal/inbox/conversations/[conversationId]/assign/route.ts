import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getConversation, assignConversationToPortalUser } from '@/lib/conversations';
import { listPortalUsers } from '@/lib/tenantPortalUsers';

export const POST = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { conversationId: string } }) => {
    const conversation = await getConversation(session.tenantId, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { userId?: string | null };
    if (body.userId) {
      // The assignee must belong to this tenant — the FK alone accepts any
      // tenant's portal-user id.
      const users = await listPortalUsers(session.tenantId);
      if (!users.some((u) => u.id === body.userId)) {
        return NextResponse.json({ error: 'Unknown team member' }, { status: 400 });
      }
    }
    await assignConversationToPortalUser(session.tenantId, conversation.id, body.userId ?? null);

    return NextResponse.json({ ok: true });
  }
);
