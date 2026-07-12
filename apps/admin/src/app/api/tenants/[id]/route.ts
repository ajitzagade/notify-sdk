import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant, updateTenantBranding, getCredentialStatus } from '@/lib/tenants';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const credentials = await getCredentialStatus(tenant.id);
  return NextResponse.json({ tenant, credentials });
});

export const PATCH = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const body = (await req.json()) as {
    name?: string; primaryColor?: string; secondaryColor?: string; businessDescription?: string;
  };
  const tenant = await updateTenantBranding(ctx.params.id, body);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json({ tenant });
});
