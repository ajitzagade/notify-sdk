import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { updateCannedResponse, deleteCannedResponse } from '@/lib/cannedResponses';

export const PATCH = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; responseId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = (await req.json()) as { label?: string; body?: string };
    if (body.label !== undefined && !body.label.trim()) {
      return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
    }
    if (body.body !== undefined && !body.body.trim()) {
      return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });
    }
    const response = await updateCannedResponse(tenant.id, ctx.params.responseId, body);
    if (!response) return NextResponse.json({ error: 'Canned response not found' }, { status: 404 });

    return NextResponse.json({ response });
  }
);

export const DELETE = withAdminSession(
  async (_session, _req: NextRequest, ctx: { params: { id: string; responseId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    await deleteCannedResponse(tenant.id, ctx.params.responseId);
    return NextResponse.json({ ok: true });
  }
);
