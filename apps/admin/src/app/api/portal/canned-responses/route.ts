import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listCannedResponses, createCannedResponse } from '@/lib/cannedResponses';

export const GET = withPortalSession(async (session) => {
  const responses = await listCannedResponses(session.tenantId);
  return NextResponse.json({ responses });
});

export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { label?: string; body?: string };
  if (!body.label?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'label and body are required' }, { status: 400 });
  }

  const response = await createCannedResponse(session.tenantId, body.label.trim(), body.body.trim());
  return NextResponse.json({ response }, { status: 201 });
});
