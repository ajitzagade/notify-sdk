import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getConversation, sendReplyInThread } from '@/lib/conversations';

export const POST = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; conversationId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const conversation = await getConversation(tenant.id, ctx.params.conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const body = (await req.json()) as { text?: string };
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    try {
      const event = await sendReplyInThread(tenant.id, conversation.contactPhone, body.text.trim());
      return NextResponse.json({ ok: true, event });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
);
