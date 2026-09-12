import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { submitStarterTemplate } from '@/lib/starterTemplateSubmit';

export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { key?: string };
  if (!body.key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  const result = await submitStarterTemplate(session.tenantId, body.key);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.statusCode });

  return NextResponse.json({ name: result.name, status: result.status });
});
