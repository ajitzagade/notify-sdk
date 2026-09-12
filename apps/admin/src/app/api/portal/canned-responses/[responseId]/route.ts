import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { updateCannedResponse, deleteCannedResponse } from '@/lib/cannedResponses';

export const PATCH = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { responseId: string } }) => {
    const body = (await req.json()) as { label?: string; body?: string };
    if (body.label !== undefined && !body.label.trim()) {
      return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
    }
    if (body.body !== undefined && !body.body.trim()) {
      return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });
    }
    const response = await updateCannedResponse(session.tenantId, ctx.params.responseId, body);
    if (!response) return NextResponse.json({ error: 'Canned response not found' }, { status: 404 });

    return NextResponse.json({ response });
  }
);

export const DELETE = withPortalSession(
  async (session, _req: NextRequest, ctx: { params: { responseId: string } }) => {
    await deleteCannedResponse(session.tenantId, ctx.params.responseId);
    return NextResponse.json({ ok: true });
  }
);
